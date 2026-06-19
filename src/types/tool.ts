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
  /**
   * True when this result is the synthetic acknowledgement of a
   * non-blocking (fire-and-forget) dispatch — the tool is still running
   * in the background. The real outcome arrives via the result store and
   * is injected as context on the next turn. Distinct from `success`,
   * which only reflects whether the *dispatch* was accepted.
   */
  dispatched?: boolean;
  /** Operation id linking the synthetic result to its background task. */
  operationId?: string;
}

export interface ParsedToolCall {
  tool: string;
  arg: string;
}

export interface PendingOperation {
  id: string;
  tool: string;
  arg: string;
  startedAt: number;
  status: "pending";
}

export interface CompletedOperation {
  id: string;
  tool: string;
  arg: string;
  startedAt: number;
  completedAt: number;
  status: "success" | "failure";
  result: ToolResult;
}

export interface DispatchedResult {
  tool: string;
  result: string;
  success: true;
  normalizedArg: string;
  dispatched: true;
  operationId: string;
}
