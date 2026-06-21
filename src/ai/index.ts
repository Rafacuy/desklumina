/**
 * AI module exports
 */

export { streamAI, getAvailableModels, getModelInfo } from "./runtime/orchestrator";
export { initializeAI } from "./runtime/init";
export { buildSystemPrompt } from "./runtime/prompts";
export { textToSpeech, isTTSPlaying, cancelTTS } from "./tts";
export type {
  AIProvider,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderCapability,
  ProviderConfig,
  ProviderId,
  ProviderRequest,
  ProviderStreamChunk,
  ProviderValidationResult,
  TokenUsage,
} from "./types";
export {
  AuthenticationError,
  ProviderAPIError,
  ProviderError,
  ProviderNetworkError,
  ProviderParseError,
  RateLimitError,
  BaseProvider,
  GroqProvider,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OpenRouterProvider,
  HuggingFaceProvider,
} from "./providers";
export { providerRegistry, modelRegistry, parseModelRef } from "./registry";
