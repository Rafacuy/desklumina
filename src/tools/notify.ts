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

    const command = `dunstify -u ${urgency} -i lumina "${title}" "${body}"`;

    const proc = Bun.spawn(["dunstify", "-u", urgency, "-i", "lumina", title, body], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      logger.warn("notify", `Notification failed: ${stderr}`);
      return buildResult(args.trim(), `❌ Error: ${stderr || "Failed to send notification"}`, false, command, stdout, stderr, exitCode);
    }

    return buildResult(`${title}|${body}|${urgency}`, "✓ Notification sent", true, command, stdout, stderr, 0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("notify", `Notification failed: ${err.message}`, err);
    return buildResult(args.trim(), `❌ Error: ${err.message}`, false, undefined, undefined, err.message, 1);
  }
}
