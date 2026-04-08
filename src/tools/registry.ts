import { execute } from "./terminal";
import { launch } from "./apps";
import { fileOp } from "./files";
import { media } from "./media";
import { clipboard } from "./clipboard";
import { notify } from "./notify";
import { logger } from "../logger";
import { CancellationError } from "../types";
import type { ToolExecutionResult, ToolHandler, ToolRegistry } from "../types";

const tools: ToolRegistry = {
  terminal: async (cmd) => {
    const result = await execute(cmd);
    const message = result.exitCode === 0
      ? (result.stdout || result.stderr || "Done")
      : `❌ ${result.stderr || "Command failed"}`;
    return {
      tool: "terminal",
      result: message,
      success: result.exitCode === 0,
      normalizedArg: cmd.trim(),
      command: cmd,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  },
  app: (alias) => launch(alias),
  file: (op) => fileOp(op),
  media: (action) => media(action),
  clipboard: (action) => clipboard(action),
  notify: (args) => notify(args),
};

/**
 * Dispatch a tool call to the appropriate handler
 */
export async function dispatch(toolName: string, arg: string): Promise<ToolExecutionResult> {
  const handler = tools[toolName];
  if (!handler) {
    logger.warn("tools", `Tool not found: ${toolName}`);
    return {
      tool: toolName,
      result: `⚠️ Tool '${toolName}' not found`,
      success: false,
      normalizedArg: arg.trim(),
      stderr: `Tool '${toolName}' not found`,
      exitCode: 404,
    };
  }

  try {
    logger.debug("tools", `Executing ${toolName} with arg: ${arg}`);
    const result = await handler(arg);
    const status = result.success ? "success" : "failure";
    logger.debug("tools", `${toolName} completed with ${status}`);
    return result;
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("tools", `Error in ${toolName}: ${err.message}`, err);
    return {
      tool: toolName,
      result: `❌ ${toolName} error: ${err.message}`,
      success: false,
      normalizedArg: arg.trim(),
      stderr: err.message,
      exitCode: 1,
    };
  }
}

/**
 * Get list of registered tool names
 */
export function getRegisteredTools(): string[] {
  return Object.keys(tools);
}

/**
 * Register a new tool handler
 */
export function registerTool(name: string, handler: ToolHandler): void {
  if (tools[name]) {
    logger.warn("tools", `Tool ${name} already registered, overwriting...`);
  }
  tools[name] = handler;
  logger.info("tools", `Tool ${name} registered`);
}
