import { execute } from "./terminal";
import { launch } from "./apps";
import { bspwm } from "./bspwm";
import { fileOp } from "./files";
import { media } from "./media";
import { clipboard } from "./clipboard";
import { notify } from "./notify";
import { logger } from "../logger";
import type { ToolHandler, ToolRegistry } from "../types";

const tools: ToolRegistry = {
  terminal: async (cmd) => {
    const result = await execute(cmd);
    return result.stdout || result.stderr || "Done";
  },
  app: async (alias) => {
    await launch(alias);
    return `${alias} launched`;
  },
  bspwm: (action) => bspwm(action),
  file: (op) => fileOp(op),
  media: (action) => media(action),
  clipboard: (action) => clipboard(action),
  notify: (args) => notify(args),
};

/**
 * Dispatch a tool call to the appropriate handler
 */
export async function dispatch(toolName: string, arg: string): Promise<string> {
  const handler = tools[toolName];
  if (!handler) {
    logger.warn("tools", `Tool not found: ${toolName}`);
    return `⚠️ Tool '${toolName}' not found`;
  }

  try {
    logger.debug("tools", `Executing ${toolName} with arg: ${arg}`);
    const result = await handler(arg);
    logger.debug("tools", `${toolName} completed successfully`);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("tools", `Error in ${toolName}: ${err.message}`, err);
    return `❌ ${toolName} error: ${err.message}`;
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
