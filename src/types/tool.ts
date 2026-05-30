export interface ToolCall {
  tool: string;
  arg: string;
}

export interface FileMatch {
  path: string;
  name: string;
  directory: string;
  type: "file" | "directory" | "missing";
  extension?: string;
  hidden: boolean;
  size?: number;
}

export interface FilePreview {
  path: string;
  type: "file" | "directory" | "missing";
  content?: string;
  entries?: string[];
  truncated?: boolean;
  unavailableReason?: string;
}

export interface ToolExecutionSummary {
  mode?: string;
  query?: string;
  totalMatches?: number;
  filteredMatches?: number;
  returnedMatches?: number;
}

export interface ToolCallbackPayload {
  type: "pending" | "retry" | "results";
  text: string;
  results?: ToolResult[];
  tools?: string[];
  reason?: string;
}

export interface TrackInfo {
  backend: "mpc" | "playerctl";
  player: string;
  status: "playing" | "paused" | "stopped";
  title: string | null;
  artist: string | null;
  album: string | null;
  elapsed: string | null;
  duration: string | null;
}

/**
 * Extensible container for structured tool data sent to the AI.
 * Each field is optional — tools only populate what's relevant.
 * To add a new extra type:
 *   1. Add an optional field here
 *   2. Add a formatter in EXTRA_FORMATTERS (chat-manager.ts)
 */
export interface ToolExtraData {
  tracks?: TrackInfo[];
  activePrimaryBackend?: "mpc" | "playerctl" | null;
  files?: FileMatch[];
  selectedFile?: string;
  preview?: FilePreview;
  summary?: ToolExecutionSummary;
}

export interface ToolExecutionResult {
  tool: string;
  result: string;
  success: boolean;
  normalizedArg?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  status?: string;
  expression?: string;
  numericResult?: number;
  actions?: string[];
  resolvedBackend?: "mpc" | "playerctl";
  extra?: ToolExtraData;
}

export type ToolHandler = (arg: string) => Promise<ToolExecutionResult>;

export type ToolRegistry = Record<string, ToolHandler>;

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
  status?: string;
  expression?: string;
  numericResult?: number;
  actions?: string[];
  resolvedBackend?: "mpc" | "playerctl";
  extra?: ToolExtraData;
}

export interface ParsedToolCall {
  tool: string;
  arg: string;
}
