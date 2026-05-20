import { StreamingBaseProvider } from "../provider/streaming-base";
import type {
  ProviderCapability,
  ProviderId,
  ProviderRequest,
  ProviderStreamChunk,
  ProviderValidationResult,
  TokenUsage,
} from "../types";
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
    };
  }

  validateConfig(): ProviderValidationResult {
    const errors: string[] = [];
    if (!this.apiKey.trim()) errors.push(`${this.id.toUpperCase()}_API_KEY is required`);
    return { ok: errors.length === 0, errors };
  }

  protected getEndpoint(): string {
    return this.baseUrl;
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
}
