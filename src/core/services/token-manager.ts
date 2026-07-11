import { logger } from "../../logger";

/**
 * TokenManager handles token estimation and TPM (Tokens Per Minute) tracking.
 */
export class TokenManager {
  private static instance: TokenManager;
  
  // TPM window (1 minute)
  private readonly WINDOW_MS = 60_000;
  private usageHistory: { timestamp: number; tokens: number }[] = [];
  
  // Configurable TPM limit per provider (default: no hard limit)
  private tpmLimit = 0;
  private readonly WARNING_THRESHOLD = 0.8; // 80%

  private constructor() {}

  /**
   * Set the TPM limit for the current provider.
   * Pass 0 to disable the limit.
   */
  setTpmLimit(limit: number): void {
    this.tpmLimit = limit;
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Rough token math. Good enough for routing + TPM guardrails, not billing.
   */
  estimateTokens(text: string | null | undefined): number {
    if (!text) return 0;
    
    let tokens = 0;
    
    //Han is dense. Most BPEs sit near one token per char, so pad it a bit.
    const hanMatches = text.match(/[\u4e00-\u9fff]+/g);
    if (hanMatches) tokens += hanMatches.join('').length * 1.2;

    // Kana is boring in a good way: about one token per char.
    const kanaMatches = text.match(/[\u3040-\u30ff]+/g);
    if (kanaMatches) tokens += kanaMatches.join('').length * 1.0;

    // Hangul blocks pack a lot into one glyph; english-heavy BPEs split it up.
    const hangulMatches = text.match(/[\uac00-\ud7af]+/g);
    if (hangulMatches) tokens += hangulMatches.join('').length * 1.4;

    // Long Latin words are usually compounds or identifiers. price those higher
    // instead of pretending we can detect "German" from Unicode ranges.
    const LATIN_COMPOUND_LENGTH_THRESHOLD = 12; // chars; long unbroken words are compound-like
    const LATIN_BASE_MULTIPLIER = 0.25;
    const LATIN_COMPOUND_MULTIPLIER = 0.4;
    const latinMatches = text.match(/[a-zA-ZÀ-ÖØ-öø-ʯ]+/g);
    if (latinMatches) {
      for (const word of latinMatches) {
        const multiplier = word.length > LATIN_COMPOUND_LENGTH_THRESHOLD
          ? LATIN_COMPOUND_MULTIPLIER
          : LATIN_BASE_MULTIPLIER;
        tokens += word.length * multiplier;
      }
    }

    //Cyrillic fragments harder in english-heavy vocabularies.
    const cyrillicMatches = text.match(/[\u0400-\u04FF]+/g);
    if (cyrillicMatches) {
      tokens += cyrillicMatches.join('').length * 0.45;
    }

    // 4. Numbers and punctuation: 0.5 tokens per char (1 token per 2 chars)
    const denseMatches = text.match(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/g);
    if (denseMatches) {
      tokens += denseMatches.join('').length * 0.5;
    }
    
    // 5. Whitespace: 0.25 tokens per char
    const spaceMatches = text.match(/\s+/g);
    if (spaceMatches) {
      tokens += spaceMatches.join('').length * 0.25;
    }

    // 6. Emojis and other Unicode: 2.0 tokens per character
    const totalCounted = (hanMatches?.join('').length || 0) +
                         (kanaMatches?.join('').length || 0) +
                         (hangulMatches?.join('').length || 0) +
                         (latinMatches?.join('').length || 0) + 
                         (cyrillicMatches?.join('').length || 0) +
                         (denseMatches?.join('').length || 0) + 
                         (spaceMatches?.join('').length || 0);
    
    const remaining = Math.max(0, text.length - totalCounted);
    tokens += remaining * 2.0;

    return Math.ceil(tokens);
  }

  /**
   * Track token usage.
   */
  trackUsage(tokens: number): void {
    const now = Date.now();
    this.usageHistory.push({ timestamp: now, tokens });
    this.pruneHistory();

    const currentTPM = this.getCurrentTPM();
    if (this.tpmLimit > 0 && currentTPM > this.tpmLimit * this.WARNING_THRESHOLD) {
      logger.warn("token-manager", `TPM Usage High: ${currentTPM}/${this.tpmLimit} (${Math.round((currentTPM / this.tpmLimit) * 100)}%)`);
    } else {
      logger.debug("token-manager", `Current TPM: ${currentTPM}`);
    }
  }

  /**
   * Get current TPM (Tokens Per Minute).
   */
  getCurrentTPM(): number {
    this.pruneHistory();
    return this.usageHistory.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  /**
   * Check if a request of certain size will likely trigger a 429.
   */
  isLikelyToLimit(estimatedTokens: number): boolean {
    if (this.tpmLimit <= 0) return false;
    const currentTPM = this.getCurrentTPM();
    return (currentTPM + estimatedTokens) > this.tpmLimit;
  }

  /**
   * Enforce TPM budget by waiting if necessary.
   */
  async enforceBudget(estimatedTokens: number): Promise<void> {
    if (this.tpmLimit <= 0) return;

    if (estimatedTokens > this.tpmLimit) {
      throw new Error(`Request size (${estimatedTokens} tokens) exceeds total TPM limit (${this.tpmLimit}).`);
    }

    let currentTPM = this.getCurrentTPM();
    if (currentTPM + estimatedTokens > this.tpmLimit) {
      logger.warn("token-manager", `TPM limit approaching. Throttling request...`);

      // Simple backoff: wait for the oldest entry to expire or a fixed interval
      // Since history is pruned on getCurrentTPM, we can just wait a bit and retry check
      while (this.getCurrentTPM() + estimatedTokens > this.tpmLimit) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      logger.info("token-manager", "TPM budget cleared. Resuming request.");
    }
  }

  private pruneHistory(): void {
    const now = Date.now();
    this.usageHistory = this.usageHistory.filter(
      (entry) => now - entry.timestamp < this.WINDOW_MS
    );
  }
}

export const tokenManager = TokenManager.getInstance();
