import { execute } from "./terminal";
import { handleFileManagement, parseQuotedArgs } from "./file-management";
import { logger } from "../logger";
import { rofiConfirm } from "../security/confirmation";
import { CancellationError } from "../types";
import type { ToolExecutionResult } from "../types";

function expandPath(path: string): string {
  return path.replace(/^~/, process.env.HOME || "");
}

function isDangerousPath(path: string): boolean {
  const dangerous = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/root", "/sys", "/usr", "/var"];
  const expandedPath = expandPath(path);
  return dangerous.some((entry) => expandedPath === entry || expandedPath.startsWith(`${entry}/`));
}

function result(
  normalizedArg: string,
  message: string,
  success: boolean,
  command?: string,
  stdout?: string,
  stderr?: string,
  exitCode?: number
): ToolExecutionResult {
  return {
    tool: "file",
    result: message,
    success,
    normalizedArg,
    command,
    stdout,
    stderr,
    exitCode,
  };
}

async function spawnSafe(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

export async function fileOp(operation: string): Promise<ToolExecutionResult> {
  logger.info("files", `Operation: ${operation}`);

  try {
    const advancedResult = await handleFileManagement(operation);
    if (advancedResult) {
      return advancedResult;
    }

    const allArgs = parseQuotedArgs(operation.trim());
    const cmd = allArgs[0]?.toLowerCase();
    const args = allArgs.slice(1).map(expandPath);

    const ops: Record<string, () => Promise<ToolExecutionResult>> = {
      create_dir: async () => {
        if (!args[0]) return result("create_dir", "❌ Path not found", false, undefined, undefined, "Missing path", 2);
        const command = ["mkdir", "-p", args[0]!];
        const commandResult = await spawnSafe(command);
        const cmdStr = command.join(" ");
        if (commandResult.exitCode !== 0) return result("create_dir", `❌ Failed: ${commandResult.stderr}`, false, cmdStr, commandResult.stdout, commandResult.stderr, commandResult.exitCode);
        return result("create_dir", `✓ Folder "${args[0]}" created`, true, cmdStr, commandResult.stdout, commandResult.stderr, 0);
      },
      delete: async () => {
        if (!args[0]) return result("delete", "❌ Path not found", false, undefined, undefined, "Missing path", 2);
        if (args[0] === "/" || args[0] === expandPath("~")) {
          return result("delete", "❌ Dangerous operation cancelled (root or home)", false, undefined, undefined, "Dangerous operation cancelled", 2);
        }

        if (isDangerousPath(args[0])) {
          await rofiConfirm("Delete Operation", `Path: ${args[0]}\n\nThis is a critical system path!`, "critical");
        }

        const command = ["rm", "-rf", args[0]!];
        const commandResult = await spawnSafe(command);
        const cmdStr = command.join(" ");
        if (commandResult.exitCode !== 0) return result("delete", `❌ Failed: ${commandResult.stderr}`, false, cmdStr, commandResult.stdout, commandResult.stderr, commandResult.exitCode);
        return result("delete", `✓ "${args[0]}" deleted`, true, cmdStr, commandResult.stdout, commandResult.stderr, 0);
      },
      move: async () => {
        if (args.length < 2) return result("move", "❌ Source and destination required", false, undefined, undefined, "Source and destination required", 2);
        const src = args[0]!;
        const dest = args[1]!;
        if (!src || !dest) return result("move", "❌ Incomplete path", false, undefined, undefined, "Incomplete path", 2);
        if (isDangerousPath(src) || isDangerousPath(dest)) {
          await rofiConfirm("Move Operation", `From: ${src}\nTo: ${dest}\n\nInvolves critical system path!`, "high");
        }

        const command = ["mv", src, dest];
        const commandResult = await spawnSafe(command);
        const cmdStr = command.join(" ");
        if (commandResult.exitCode !== 0) return result("move", `❌ Failed: ${commandResult.stderr}`, false, cmdStr, commandResult.stdout, commandResult.stderr, commandResult.exitCode);
        return result("move", `✓ Moved to "${dest}"`, true, cmdStr, commandResult.stdout, commandResult.stderr, 0);
      },
      copy: async () => {
        if (args.length < 2) return result("copy", "❌ Source and destination required", false, undefined, undefined, "Source and destination required", 2);
        const command = ["cp", "-r", args[0]!, args[1]!];
        const commandResult = await spawnSafe(command);
        const cmdStr = command.join(" ");
        if (commandResult.exitCode !== 0) return result("copy", `❌ Failed: ${commandResult.stderr}`, false, cmdStr, commandResult.stdout, commandResult.stderr, commandResult.exitCode);
        return result("copy", `✓ Copied to "${args[1]}"`, true, cmdStr, commandResult.stdout, commandResult.stderr, 0);
      },
      list: async () => {
        const path = args[0] || ".";
        const command = ["ls", "-la", path];
        const commandResult = await spawnSafe(command);
        const cmdStr = command.join(" ");
        if (commandResult.exitCode !== 0) return result("list", `❌ Failed: ${commandResult.stderr}`, false, cmdStr, commandResult.stdout, commandResult.stderr, commandResult.exitCode);
        return result("list", commandResult.stdout, true, cmdStr, commandResult.stdout, commandResult.stderr, 0);
      },
      read: async () => {
        if (!args[0]) return result("read", "❌ Path not found", false, undefined, undefined, "Missing path", 2);
        try {
          const file = Bun.file(args[0]);
          if (!(await file.exists())) return result("read", "❌ File not found", false, undefined, undefined, "File not found", 404);
          const text = await file.text();
          return result("read", text, true, undefined, text, undefined, 0);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error("files", `Read failed: ${err.message}`, err);
          return result("read", `❌ Failed to read: ${err.message}`, false, undefined, undefined, err.message, 1);
        }
      },
      write: async () => {
        if (args.length < 2) return result("write", "❌ Path and content required", false, undefined, undefined, "Path and content required", 2);
        const path = args[0];
        if (!path) return result("write", "❌ Path not found", false, undefined, undefined, "Missing path", 2);
        const content = allArgs.slice(2).join(" ");
        try {
          await Bun.write(path as string, content);
          return result("write", `✓ File "${path}" written`, true, undefined, content, undefined, 0);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error("files", `Write failed: ${err.message}`, err);
          return result("write", `❌ Failed to write: ${err.message}`, false, undefined, undefined, err.message, 1);
        }
      },
      find: async () => {
        const legacy = await handleFileManagement(operation);
        if (legacy) {
          return legacy;
        }
        return result("find", "❌ Path and pattern required", false, undefined, undefined, "Path and pattern required", 2);
      },
    };

    const handler = cmd ? ops[cmd] : undefined;
    if (handler) {
      return await handler();
    }

    return result(
      operation.trim(),
      "❌ Unknown file action. Supported actions: create_dir, delete, move, copy, list, read, write, find, search_name, search_path, search_pattern, preview, history, repeat_last.",
      false,
      undefined,
      undefined,
      "Unknown file action",
      2
    );
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("files", `File operation failed: ${err.message}`, err);
    return result(operation.trim(), `❌ Error: ${err.message}`, false, undefined, undefined, err.message, 1);
  }
}
