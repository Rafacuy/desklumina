/**
 * Default fallback models if not specified in .env
 */
export const DEFAULT_FALLBACK_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
];

/**
 * Default model configuration
 */
export const DEFAULT_MODEL_NAME = "openai/gpt-oss-120b" as const;

/**
 * Groq API endpoint
 */
export const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions" as const;

/**
 * Model temperature for AI responses
 */
export const MODEL_TEMPERATURE = 0.7;

/**
 * Maximum tokens for AI response
 */
export const MAX_TOKENS = 2048;
