import { execute } from "./terminal";
import { logger } from "../logger";
import type { ToolExecutionResult } from "../types";

function buildResult(
  normalizedArg: string,
  message: string,
  success: boolean,
  command?: string,
  stdout?: string,
  stderr?: string,
  exitCode?: number
): ToolExecutionResult {
  return {
    tool: "notify",
    result: message,
    success,
    normalizedArg,
    command,
    stdout,
    stderr,
    exitCode,
  };
}

export async function notify(args: string): Promise<ToolExecutionResult> {
  logger.info("notify", `Notification: ${args}`);

  try {
    const parts = args.split("|");
    const title = parts[0]?.trim() || "Lumina";
    const body = parts[1] || "";
    const urgency = (parts[2]?.trim() || "normal").toLowerCase();

    if (!["low", "normal", "critical"].includes(urgency)) {
      return buildResult(args.trim(), "❌ Invalid urgency. Use low, normal, or critical.", false, undefined, undefined, "Invalid urgency", 2);
    }

    const safeTitle = title.replace(/"/g, '\\"');
    const safeBody = body.replace(/"/g, '\\"');
    const command = `dunstify -u ${urgency} -i lumina "${safeTitle}" "${safeBody}"`;

    const result = await execute(command);
    
    if (result.exitCode !== 0) {
      logger.warn("notify", `Notification failed: ${result.stderr}`);
      return buildResult(args.trim(), `❌ Error: ${result.stderr || "Failed to send notification"}`, false, command, result.stdout, result.stderr, result.exitCode);
    }
    
    return buildResult(`${title}|${body}|${urgency}`, "✓ Notification sent", true, command, result.stdout, result.stderr, 0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("notify", `Notification failed: ${err.message}`, err);
    return buildResult(args.trim(), `❌ Error: ${err.message}`, false, undefined, undefined, err.message, 1);
  }
}
