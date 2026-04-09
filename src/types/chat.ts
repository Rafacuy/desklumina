import type { ToolCall, ToolResult } from "./tool";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMetadata {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
}
