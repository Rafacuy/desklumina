/**
 * AI message structure for API calls
 */
export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  primaryModel: string;
  fallbackModels: string[];
  getAllModels: () => string[];
}

/**
 * Groq API error
 */
export interface GroqAPIErrorData {
  statusCode: number;
  body: string;
  model: string;
}

/**
 * Stream chunk callback
 */
export type StreamChunkHandler = (chunk: string) => void;
