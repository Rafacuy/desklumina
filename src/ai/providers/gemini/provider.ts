import { GEMINI_API_BASE } from "../../../constants";
import { StreamingBaseProvider } from "../streaming-base";
import type {
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderRequest,
  ProviderStreamChunk,
  ProviderValidationResult,
} from "../../types";
import { ProviderAPIError, ProviderParseError } from "../../errors";
import { normalizeProviderError } from "../../transport/http";
import type { SSEEvent } from "../../stream/sse-parser";

export const GEMINI_PROVIDER_ID = "gemini" as const;

interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiStreamChunk {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
    status?: string;
  };
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[];
  };
}

export class GeminiProvider extends StreamingBaseProvider {
  readonly id = GEMINI_PROVIDER_ID;
  readonly name = "Google Gemini";
  protected readonly apiKey: string;

  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super(fetchImpl);
    this.apiKey = apiKey;
  }

  validateConfig(): ProviderValidationResult {
    const errors: string[] = [];
    if (!this.apiKey.trim()) errors.push("GEMINI_API_KEY is required");
    return { ok: errors.length === 0, errors };
  }

  capabilities() {
    return {
      maxContextTokens: 128_000,
      streamingSupported: true,
      visionSupported: false,
      jsonModeSupported: false,
      functionCallingSupported: false,
      embeddingsSupported: true,
    };
  }

  protected getEndpoint(request: ProviderRequest): string {
    return `${GEMINI_API_BASE}/models/${request.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
  }

  protected getEmbeddingEndpoint(model: string): string {
    return `${GEMINI_API_BASE}/models/${model}:embedContent?key=${encodeURIComponent(this.apiKey)}`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": this.apiKey,
    };
  }

  protected getRequestBody(request: ProviderRequest): GeminiRequestBody {
    const systemMessages = request.messages.filter((m) => m.role === "system");
    const otherMessages = request.messages.filter((m) => m.role !== "system");

    const contents: GeminiContent[] = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    return {
      contents,
      systemInstruction:
        systemMessages.length > 0
          ? { parts: [{ text: systemMessages.map((m) => m.content).join("\n\n") }] }
          : undefined,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    };
  }

  protected parseChunk(event: SSEEvent): ProviderStreamChunk | null {
    if (event.data === "[DONE]") return null;

    let parsed: GeminiStreamChunk;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return null;
    }

    if (parsed.error) {
      throw new ProviderAPIError({
        provider: this.id,
        message: parsed.error.message ?? "Unknown Gemini stream error",
        retryable: parsed.error.status === "RESOURCE_EXHAUSTED",
        rawPayload: event.data,
      });
    }

    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    const usage = parsed.usageMetadata ? {
      promptTokens: parsed.usageMetadata.promptTokenCount ?? 0,
      completionTokens: parsed.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: parsed.usageMetadata.totalTokenCount ?? 0,
    } : undefined;

    const finishReason = parsed.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
       // We can just log it or throw if it's an error. 
       // For now keep it simple and just return the chunk.
    }

    return { content: text, usage };
  }

  protected isRetryable(status: number, parsed: any): boolean {
    return parsed?.error?.status === "RESOURCE_EXHAUSTED" || status >= 500;
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const validation = this.validateConfig();
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    const response = await this.fetchImpl(this.getEmbeddingEndpoint(request.model), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: `models/${request.model}`,
        content: {
          parts: [{ text: request.input }],
        },
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      throw await normalizeProviderError({
        provider: this.id,
        response,
      });
    }

    let parsed: GeminiEmbeddingResponse;
    try {
      parsed = await response.json() as GeminiEmbeddingResponse;
    } catch (error) {
      throw new ProviderParseError({
        provider: this.id,
        message: error instanceof Error ? error.message : "Failed to parse embedding response",
        retryable: false,
        cause: error,
      });
    }

    const embedding = parsed.embedding?.values;
    if (!Array.isArray(embedding)) {
      throw new ProviderParseError({
        provider: this.id,
        message: "Embedding response missing vector values",
        retryable: false,
      });
    }

    return { embedding };
  }
}
