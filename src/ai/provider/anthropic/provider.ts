import { ANTHROPIC_API_ENDPOINT } from "../../../constants";
import { StreamingBaseProvider } from "../streaming-base";
import type {
  ProviderCapability,
  ProviderId,
  ProviderRequest,
  ProviderStreamChunk,
  ProviderValidationResult,
} from "../../types";
import { ProviderAPIError } from "../../errors";
import type { SSEEvent } from "../../stream/sse-parser";

export const ANTHROPIC_PROVIDER_ID = "anthropic" as const;
export const ANTHROPIC_VERSION = "2023-06-01" as const;

interface AnthropicEvent {
  type: string;
  message?: {
    id: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  delta?: {
    type?: string;
    text?: string;
  };
  usage?: { output_tokens?: number };
  error?: {
    type: string;
    message: string;
  };
}

export class AnthropicProvider extends StreamingBaseProvider {
  readonly id = ANTHROPIC_PROVIDER_ID;
  readonly name = "Anthropic";
  protected readonly apiKey: string;
  
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super(fetchImpl);
    this.apiKey = apiKey;
  }

  capabilities(): ProviderCapability {
    return {
      maxContextTokens: 200_000,
      streamingSupported: true,
      visionSupported: true,
      jsonModeSupported: true,
      functionCallingSupported: true,
    };
  }

  validateConfig(): ProviderValidationResult {
    const errors: string[] = [];
    if (!this.apiKey.trim()) errors.push("ANTHROPIC_API_KEY is required");
    return { ok: errors.length === 0, errors };
  }

  protected getEndpoint(): string {
    return ANTHROPIC_API_ENDPOINT;
  }

  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    };
  }

  protected getRequestBody(request: ProviderRequest): any {
    const systemMessages = request.messages.filter((m) => m.role === "system");
    const otherMessages = request.messages.filter((m) => m.role !== "system");

    return {
      model: request.model,
      messages: otherMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      system: systemMessages.length > 0 ? systemMessages.map((m) => m.content).join("\n\n") : undefined,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature,
      stream: true,
    };
  }

  protected parseChunk(event: SSEEvent): ProviderStreamChunk | null {
    let parsed: AnthropicEvent;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return null;
    }

    switch (parsed.type) {
      case "message_start":
        if (parsed.message?.usage) {
          this.inputTokens = parsed.message.usage.input_tokens ?? 0;
          this.outputTokens = parsed.message.usage.output_tokens ?? 0;
        }
        return null;

      case "content_block_delta":
        if (parsed.delta?.text) {
          return { content: parsed.delta.text };
        }
        return null;

      case "message_delta":
        if (parsed.usage) {
          this.outputTokens = parsed.usage.output_tokens ?? this.outputTokens;
        }
        return null;

      case "message_stop":
        return {
          usage: {
            promptTokens: this.inputTokens,
            completionTokens: this.outputTokens,
            totalTokens: this.inputTokens + this.outputTokens,
          },
        };

      case "error": {
        throw new ProviderAPIError({
          provider: this.id,
          message: parsed.error?.message ?? "Unknown Anthropic stream error",
          retryable: false,
          rawPayload: event.data,
        });
      }

      default:
        return null;
    }
  }

  // Override to reset tokens on each stream
  async *streamChat(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk> {
    this.inputTokens = 0;
    this.outputTokens = 0;
    yield* super.streamChat(request);
  }
}
