/**
 * Tool call representation
 */
export interface ToolCall {
  tool: string;
  arg: string;
}

/**
 * Structured tool execution result
 */
export interface ToolExecutionResult {
  tool: string;
  result: string;
  success: boolean;
  normalizedArg?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Tool handler function type
 */
export type ToolHandler = (arg: string) => Promise<ToolExecutionResult>;

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
  success?: boolean;
  normalizedArg?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  attempt?: number;
}

/**
 * Tool call parsed from AI response
 */
export interface ParsedToolCall {
  tool: string;
  arg: string;
}
