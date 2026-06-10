import { StreamingBaseProvider } from "../providers/streaming-base";
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderCapability,
  ProviderId,
  ProviderRequest,
  ProviderStreamChunk,
  ProviderValidationResult,
  TokenUsage,
} from "../types";
import { normalizeProviderError } from "./http";
import { ProviderParseError } from "../errors";
import type { SSEEvent } from "../stream/sse-parser";

interface OpenAICompatibleAdapterOptions {
  provider: ProviderId;
  name: string;
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  extraHeaders?: Record<string, string>;
}

interface OpenAICompatibleChunk {
  choices?: readonly {
    delta?: {
      content?: string;
    };
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

interface OpenAICompatibleEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

export class OpenAICompatibleAdapter extends StreamingBaseProvider {
  readonly id: ProviderId;
  readonly name: string;
  protected readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly extraHeaders: Record<string, string>;

  constructor(options: OpenAICompatibleAdapterOptions) {
    super(options.fetchImpl);
    this.id = options.provider;
    this.name = options.name;
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
    this.extraHeaders = options.extraHeaders ?? {};
  }

  capabilities(): ProviderCapability {
    return {
      maxContextTokens: this.id === "openai" ? 200_000 : 128_000,
      streamingSupported: true,
      visionSupported: this.id === "openai",
      jsonModeSupported: this.id === "openai" || this.id === "groq",
      functionCallingSupported: this.id === "openai",
      embeddingsSupported: this.supportsEmbeddings(),
    };
  }

  /**
   * Indicates whether this OpenAI-compatible provider truly exposes the
   * `/embeddings` endpoint. Subclasses override to disable when the
   * upstream service does not implement it (e.g. Groq, OpenRouter).
   */
  protected supportsEmbeddings(): boolean {
    return true;
  }

  validateConfig(): ProviderValidationResult {
    const errors: string[] = [];
    if (!this.apiKey.trim()) errors.push(`${this.id.toUpperCase()}_API_KEY is required`);
    return { ok: errors.length === 0, errors };
  }

  protected getEndpoint(): string {
    return this.baseUrl;
  }

  protected getEmbeddingEndpoint(): string {
    return this.baseUrl.replace(/\/chat\/completions(?:\?.*)?$/i, "/embeddings");
  }

  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...this.extraHeaders,
    };
  }

  protected getRequestBody(request: ProviderRequest): any {
    return {
      model: request.model,
      messages: request.messages,
      stream: true,
      stream_options: request.streamUsage ? { include_usage: true } : undefined,
      temperature: request.temperature,
      max_completion_tokens: request.maxTokens,
    };
  }

  protected parseChunk(event: SSEEvent): ProviderStreamChunk | null {
    if (event.data === "[DONE]") return null;

    let parsed: OpenAICompatibleChunk;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return null;
    }

    const content = parsed.choices?.[0]?.delta?.content;
    const usage: TokenUsage | undefined = parsed.usage ? {
      promptTokens: parsed.usage.prompt_tokens,
      completionTokens: parsed.usage.completion_tokens,
      totalTokens: parsed.usage.total_tokens,
    } : undefined;

    return { content, usage };
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.supportsEmbeddings()) {
      throw new Error(`Provider ${this.id} does not support embeddings`);
    }

    const validation = this.validateConfig();
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    const response = await this.fetchImpl(this.getEmbeddingEndpoint(), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model,
        input: request.input,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      throw await normalizeProviderError({
        provider: this.id,
        response,
      });
    }

    let parsed: OpenAICompatibleEmbeddingResponse;
    try {
      parsed = await response.json() as OpenAICompatibleEmbeddingResponse;
    } catch (error) {
      throw new ProviderParseError({
        provider: this.id,
        message: error instanceof Error ? error.message : "Failed to parse embedding response",
        retryable: false,
        cause: error,
      });
    }

    const embedding = parsed.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new ProviderParseError({
        provider: this.id,
        message: "Embedding response missing vector data",
        retryable: false,
      });
    }

    return { embedding };
  }
}
