import { execute } from "./terminal";
import { logger } from "../logger";
import type { ToolExecutionResult } from "../types";

function success(
  normalizedArg: string,
  result: string,
  command: string,
  stdout: string
): ToolExecutionResult {
  return {
    tool: "clipboard",
    result,
    success: true,
    normalizedArg,
    command,
    stdout,
    exitCode: 0,
  };
}

function failure(
  normalizedArg: string,
  result: string,
  command?: string,
  stderr?: string,
  exitCode: number = 1
): ToolExecutionResult {
  return {
    tool: "clipboard",
    result,
    success: false,
    normalizedArg,
    command,
    stderr,
    exitCode,
  };
}

export async function clipboard(action: string): Promise<ToolExecutionResult> {
  logger.info("clipboard", `Action: ${action}`);

  try {
    const parts = action.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(" ");

    const actions: Record<string, () => Promise<ToolExecutionResult>> = {
      get: async () => {
        const command = "clipcatctl get";
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("get", `❌ Error: ${result.stderr}`, command, result.stderr, result.exitCode);
        return success("get", result.stdout || "Clipboard is empty", command, result.stdout);
      },
      list: async () => {
        const command = "clipcatctl list";
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("list", `❌ Error: ${result.stderr}`, command, result.stderr, result.exitCode);
        return success("list", result.stdout || "No history", command, result.stdout);
      },
      set: async () => {
        if (!arg) return failure("set", "❌ Clipboard set requires text content", undefined, "Missing clipboard content", 2);
        const command = `printf %s "${arg.replace(/"/g, '\\"')}" | clipcatctl insert`;
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("set", `❌ Error: ${result.stderr}`, command, result.stderr, result.exitCode);
        return success("set", "✓ Clipboard set", command, result.stdout);
      },
      clear: async () => {
        const command = "clipcatctl clear";
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("clear", `❌ Error: ${result.stderr}`, command, result.stderr, result.exitCode);
        return success("clear", "✓ Clipboard cleared", command, result.stdout);
      },
    };

    return (cmd && actions[cmd]) ? await actions[cmd]() : failure(action.trim(), "❌ Unknown clipboard action", undefined, "Unknown clipboard action", 2);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("clipboard", `Clipboard operation failed: ${err.message}`, err);
    return failure(action.trim(), `❌ Error: ${err.message}`, undefined, err.message);
  }
}
