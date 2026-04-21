import { t } from "../utils";
import { logger } from "../logger";
import { analyzeCommand, rofiConfirm } from "../security";
import { COMMAND_TIMEOUT } from "../constants";
import { CancellationError } from "../types";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut?: boolean;
}

/**
 * Execute a shell command with timeout and security checks
 */
export async function execute(command: string): Promise<CommandResult> {
  logger.info("terminal", `Executing: ${command}`);

  try {
    // Security analysis of command
    const analysis = analyzeCommand(command);

    if (analysis.isDangerous) {
      const severity = analysis.highestSeverity as "critical" | "high" | "medium";

      logger.warn(
        "terminal",
        `Dangerous command detected [${severity}]: ${analysis.summary}`
      );

      await rofiConfirm(
        "Dangerous Command Detected",
        `Command: ${command}\n\nReason: ${analysis.summary}`,
        severity
      );

      logger.info("terminal", t("Dangerous command approved by user"));
    }

    const proc = Bun.spawn(["bash", "-c", command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill();
      logger.error("terminal", `Timeout: ${command}`);
    }, COMMAND_TIMEOUT);

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited.then((code) => {
        clearTimeout(timeout);
        return code;
      }),
    ]);

    if (exitCode !== 0) {
      logger.warn("terminal", `Exit ${exitCode}: ${stderr || "no error output"}`);
    }

    return { stdout, stderr, exitCode, timedOut };
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("terminal", `Command execution failed: ${err.message}`, err);
    return {
      stdout: "",
      stderr: `Execution error: ${err.message}`,
      exitCode: 127,
      timedOut: false,
    };
  }
}
