import { t, tf } from "../../utils";
import { execute } from "./terminal";
import { logger } from "../../logger";
import type { ToolExecutionResult } from "../../types";

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
  logger.info("clipboard", `Action: ${action.slice(0, 100)}${action.length > 100 ? "..." : ""}`);

  try {
    const parts = action.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(" ");

    const actions: Record<string, () => Promise<ToolExecutionResult>> = {
      get: async () => {
        const command = "clipcatctl get";
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("get", tf("error.with_message", { message: result.stderr }), command, result.stderr, result.exitCode);
        return success("get", result.stdout || t("tool.result.clipboard_empty"), command, result.stdout);
      },
      list: async () => {
        const command = "clipcatctl list";
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("list", tf("error.with_message", { message: result.stderr }), command, result.stderr, result.exitCode);
        return success("list", result.stdout || t("tool.result.no_history"), command, result.stdout);
      },
      set: async () => {
        if (!arg) return failure("set", t("tool.result.invalid_request"), undefined, "Missing clipboard content", 2);
        
        const MAX_CLIPBOARD_SIZE = 1024 * 1024; // 1MB
        if (arg.length > MAX_CLIPBOARD_SIZE) {
          return failure("set", tf("error.with_message", { message: `Content too large (${arg.length} > ${MAX_CLIPBOARD_SIZE})` }), undefined, "Content exceeds 1MB limit", 2);
        }

        try {
          const proc = Bun.spawn(["clipcatctl", "insert", arg]);
          
          const exitCode = await proc.exited;
          
          if (exitCode !== 0) {
            return failure("set", tf("error.with_message", { message: `clipcatctl exited with code ${exitCode}` }), "clipcatctl insert", `Exit code ${exitCode}`, exitCode);
          }
          
          return success("set", t("tool.result.clipboard_set"), "clipcatctl insert", "");
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          return failure("set", tf("error.with_message", { message: err.message }), "clipcatctl insert", err.message, 1);
        }
      },
      clear: async () => {
        const command = "clipcatctl clear";
        const result = await execute(command);
        if (result.exitCode !== 0) return failure("clear", tf("error.with_message", { message: result.stderr }), command, result.stderr, result.exitCode);
        return success("clear", t("tool.result.clipboard_cleared"), command, result.stdout);
      },
    };

    return (cmd && actions[cmd]) ? await actions[cmd]() : failure(action.trim(), t("tool.result.invalid_request"), undefined, "Unknown clipboard action", 2);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("clipboard", `Clipboard operation failed: ${err.message}`, err);
    return failure(action.trim(), tf("error.with_message", { message: err.message }), undefined, err.message);
  }
}
