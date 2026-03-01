/**
 * Chat message role types
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * Tool call structure
 */
export interface ToolCall {
  tool: string;
  arg: string;
}

/**
 * Tool result structure
 */
export interface ToolResult {
  tool: string;
  result: string;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

/**
 * Chat session structure
 */
export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Chat metadata for listing
 */
export interface ChatMetadata {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
}
