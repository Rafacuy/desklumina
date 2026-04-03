/**
 * Type definitions for DeskLumina
 */

export * from "./chat";
export * from "./ai";
export * from "./settings";

// Re-export from tool with conflict resolution
export type { ToolHandler, ToolRegistry } from "./tool";
export type { ParsedToolCall } from "./tool";

/**
 * Custom error for when a user cancels a security confirmation
 */
export class CancellationError extends Error {
  constructor(message: string = "Operation cancelled by user") {
    super(message);
    this.name = "CancellationError";
  }
}
