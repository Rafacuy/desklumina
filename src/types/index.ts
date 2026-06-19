export * from "./chat";
export * from "./ai";
export * from "./settings";

export type {
  FileMatch,
  FilePreview,
  ParsedToolCall,
  ToolCall,
  ToolCallbackPayload,
  ToolExecutionResult,
  ToolExecutionSummary,
  ToolExtraData,
  ToolHandler,
  ToolRegistry,
  ToolResult,
  TrackInfo,
  PendingOperation,
  CompletedOperation,
  DispatchedResult,
} from "./tool";

/**
 * Custom error for when a user cancels a security confirmation
 */
export class CancellationError extends Error {
  constructor(message: string = "Operation cancelled by user") {
    super(message);
    this.name = "CancellationError";
  }
}
