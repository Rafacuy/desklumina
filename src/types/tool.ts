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
  type: "retry" | "results";
  text: string;
  results?: ToolResult[];
  tools?: string[];
  reason?: string;
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
  files?: FileMatch[];
  selectedFile?: string;
  preview?: FilePreview;
  actions?: string[];
  summary?: ToolExecutionSummary;
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
  files?: FileMatch[];
  selectedFile?: string;
  preview?: FilePreview;
  actions?: string[];
  summary?: ToolExecutionSummary;
}

export interface ParsedToolCall {
  tool: string;
  arg: string;
}
