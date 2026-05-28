import type { AIMessage, ParsedToolCall, ToolResult } from "../types";

export interface AgentContext {
  history: AIMessage[];
  turn: number;
  status: AgentStatus;
}

export type AgentStatus = "running" | "complete" | "failed";

export type TerminalSignal =
  | { type: "NONE" }
  | { type: "DONE" }
  | { type: "FAIL"; reason: string };

export type AgentEvent =
  | { type: "content"; content: string }
  | { type: "tool_pending"; tools: ParsedToolCall[] }
  | { type: "tool_retry"; attempt: number; tool: string; error: string }
  | { type: "tool_results"; results: ToolResult[] };

export interface AgentRunOptions {
  maxTurns?: number;
  onEvent?: (event: AgentEvent) => void;
}

export interface AgentResult {
  finalResponse: string;
  allToolResults: ToolResult[];
  history: AIMessage[];
  terminalSignal?: TerminalSignal;
}
