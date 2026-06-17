/**
 * Groq API endpoint
 */
export const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions" as const;

/**
 * OpenAI API endpoint
 */
export const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions" as const;

/**
 * Anthropic API endpoint
 */
export const ANTHROPIC_API_ENDPOINT = "https://api.anthropic.com/v1/messages" as const;

/**
 * Google Gemini API base URL
 */
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta" as const;

/**
 * OpenRouter API endpoint
 */
export const OPENROUTER_API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions" as const;

/**
 * Hugging Face Inference API endpoint (OpenAI-compatible chat completions)
 */
export const HF_API_ENDPOINT = "https://router.huggingface.co/v1/chat/completions" as const;

/**
 * Model temperature for AI responses
 */
export const MODEL_TEMPERATURE = 0.7;

/**
 * Maximum tokens for AI response
 */
export const MAX_TOKENS = 512;

/**
 * Safe token limit for input validation
 */
export const SAFE_TOKEN_LIMIT = 6000;
