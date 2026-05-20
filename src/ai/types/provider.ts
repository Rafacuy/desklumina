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

export interface ProviderStreamChunk {
  content?: string;
  usage?: TokenUsage;
}

export interface ProviderCapability {
  readonly maxContextTokens: number;
  readonly streamingSupported: boolean;
  readonly visionSupported: boolean;
  readonly jsonModeSupported: boolean;
  readonly functionCallingSupported: boolean;
  readonly tpmLimit?: number;
}

export interface ProviderValidationResult {
  ok: boolean;
  errors: readonly string[];
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  streamChat(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk>;
  validateConfig(): ProviderValidationResult;
  capabilities(): ProviderCapability;
}

