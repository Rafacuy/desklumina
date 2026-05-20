export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequestContext {
  messages: AIMessage[];
  truncatedMessageCount?: number;
  summarizedMessageCount?: number;
}

export interface ModelConfig {
  primaryModel: string;
  fallbackModels: string[];
  getAllModels: () => string[];
}
