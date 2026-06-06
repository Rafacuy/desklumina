interface PromptCacheKey {
  persona: string;
  lang: string;
  settingsHash: string;
}

interface PromptCacheEntry {
  prompt: string;
  createdAt: number;
}

const TTL_MS = 5 * 60 * 1000;

function makeKey(persona: string, lang: string, settingsHash: string): string {
  return `${persona}:${lang}:${settingsHash}`;
}

export class PromptCache {
  private entries = new Map<string, PromptCacheEntry>();

  get(persona: string, lang: string, settingsHash: string): string | null {
    const key = makeKey(persona, lang, settingsHash);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > TTL_MS) {
      this.entries.delete(key);
      return null;
    }
    return entry.prompt;
  }

  set(persona: string, lang: string, settingsHash: string, prompt: string): void {
    const key = makeKey(persona, lang, settingsHash);
    this.entries.set(key, { prompt, createdAt: Date.now() });
  }

  invalidate(): void {
    this.entries.clear();
  }
}
