import { t } from "../../utils";
import { logger } from "../../logger";
import { analyzeCommand, rofiConfirm } from "../../security";
import { COMMAND_TIMEOUT } from "../../constants";
import { CancellationError } from "../../types";
import { classifyCommand } from "./terminal-classify";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut?: boolean;
  dispatched?: boolean;
}

/**
 * Execute a shell command. 
 *
 * Dispatch mode is decided per-call by the
 * classifier: GUI apps and &-suffixed commands are fire-and-forget;
 * everything else blocks with a timeout so stdout/stderr/exitCode are
 * captured. Interactive ssh sessions without a remote command are
 * rejected up front.
 */
export async function execute(command: string): Promise<CommandResult> {
  logger.info("terminal", `Executing: ${command}`);

  const classification = classifyCommand(command);

  if (classification.mode === "rejected") {
    logger.warn("terminal", `Rejected: ${classification.reason}`);
    return {
      stdout: "",
      stderr: classification.reason,
      exitCode: 1,
      timedOut: false,
    };
  }

  const analysis = analyzeCommand(classification.command);
  if (analysis.isDangerous) {
    const severity = analysis.highestSeverity as "critical" | "high" | "medium";
    logger.warn("terminal", `Dangerous command detected [${severity}]: ${analysis.summary}`);
    await rofiConfirm(
      "security.dangerous_command_title",
      `Command: ${classification.command}\n\nReason: ${analysis.summary}`,
      severity
    );
    logger.info("terminal", "Dangerous command approved by user");
  }

  if (classification.mode === "non-blocking") {
    return executeDetached(classification.command);
  }

  return executeBlocking(classification.command);
}

/**
 * Fire-and-forget spawn for GUI apps and background commands.
 * Stdio is ignored and the process is detached so the agent loop
 * is not blocked on its lifetime.
 */
async function executeDetached(command: string): Promise<CommandResult> {
  try {
    const proc = Bun.spawn(["bash", "-c", command], {
      detached: true,
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      logger.warn("terminal", `Detached process exited ${exitCode}: ${command}`);
    }
    logger.info("terminal", `Dispatched (non-blocking) completed: ${command}`);

    return {
      stdout,
      stderr,
      exitCode,
      timedOut: false,
      dispatched: true,
    };
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("terminal", `Detached spawn failed: ${err.message}`, err);
    return {
      stdout: "",
      stderr: `Execution error: ${err.message}`,
      exitCode: 127,
      timedOut: false,
    };
  }
}

/**
 * Blocking execution with 
 * security checks, stdout/stderr capture,
 * and a hard timeout safety net.
 */
async function executeBlocking(command: string): Promise<CommandResult> {
  try {
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
