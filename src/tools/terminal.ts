import { t } from "../utils";
import { logger } from "../logger";
import { analyzeCommand, rofiConfirm } from "../security";
import { COMMAND_TIMEOUT } from "../constants";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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

      const confirmed = await rofiConfirm(
        "Dangerous Command Detected",
        `Command: ${command}\n\nReason: ${analysis.summary}`,
        severity
      );

      if (!confirmed) {
        logger.info("terminal", t("Command cancelled by user"));
        return {
          stdout: "",
          stderr: "Operation cancelled by user",
          exitCode: 1,
        };
      }

      logger.info("terminal", t("Dangerous command approved by user"));
    }

    const proc = Bun.spawn(["bash", "-c", command], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeout = setTimeout(() => {
      proc.kill();
      logger.error("terminal", `Timeout: ${command}`);
    }, COMMAND_TIMEOUT);

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    clearTimeout(timeout);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      logger.warn("terminal", `Exit ${exitCode}: ${stderr || "no error output"}`);
    }

    return { stdout, stderr, exitCode };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("terminal", `Command execution failed: ${err.message}`, err);
    return {
      stdout: "",
      stderr: `Execution error: ${err.message}`,
      exitCode: 127,
    };
  }
}
