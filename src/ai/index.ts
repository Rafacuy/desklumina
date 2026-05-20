/**
 * AI module exports
 */

export { streamAI, getAvailableModels, getModelInfo } from "./orchestrator";
export { initializeAI } from "./init";
export { buildSystemPrompt } from "./prompts";
export { textToSpeech } from "./tts";
export type {
  AIProvider,
  ProviderCapability,
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
} from "./provider";
export { providerRegistry, modelRegistry } from "./registry";
