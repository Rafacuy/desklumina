import type { AIMessage } from "../../types";

export type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "huggingface"
  | "openrouter";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderRequest {
  messages: readonly AIMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  streamUsage?: boolean;
  requestId?: string;
}

export interface EmbeddingRequest {
  input: string;
  model: string;
  signal?: AbortSignal;
  requestId?: string;
}

export interface ProviderStreamChunk {
  content?: string;
  usage?: TokenUsage;
}

export interface EmbeddingResponse {
  embedding: number[];
}

export interface ProviderCapability {
  readonly maxContextTokens: number;
  readonly streamingSupported: boolean;
  readonly visionSupported: boolean;
  readonly jsonModeSupported: boolean;
  readonly functionCallingSupported: boolean;
  readonly embeddingsSupported: boolean;
  readonly tpmLimit?: number;
}

/**
 * Logical pairing of chat and embedding model identifiers for a single
 * provider. `model` is the primary chat/completion model. `embedModel` is
 * the dedicated embedding model. When `embedModel` is omitted, embedding
 * callers fall back to `model` if the provider supports embeddings.
 */
export interface ProviderConfig {
  readonly model: string;
  readonly embedModel?: string;
}

export interface ProviderValidationResult {
  ok: boolean;
  errors: readonly string[];
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  streamChat(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk>;
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  validateConfig(): ProviderValidationResult;
  capabilities(): ProviderCapability;
}

