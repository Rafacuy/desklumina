/**
 * Tool call representation
 */
export interface ToolCall {
  tool: string;
  arg: string;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (arg: string) => Promise<string>;

/**
 * Tool registry mapping
 */
export type ToolRegistry = Record<string, ToolHandler>;

/**
 * Tool execution result
 */
export interface ToolResult {
  tool: string;
  result: string;
}

/**
 * Tool call parsed from AI response
 */
export interface ParsedToolCall {
  tool: string;
  arg: string;
}
