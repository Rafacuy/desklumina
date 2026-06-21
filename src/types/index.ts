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

/**
 * Wrapper for provider/system errors so the UI can classify and copy
 * the original without losing it.
 */
export class ChatRequestError extends Error {
  readonly originalError: unknown;

  constructor(originalError: unknown) {
    const msg = originalError instanceof Error
      ? originalError.message
      : String(originalError);
    super(msg);
    this.name = "ChatRequestError";
    this.originalError = originalError;
  }
}
