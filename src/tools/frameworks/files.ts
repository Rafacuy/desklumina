import { t, tf } from "../../utils";
import { basename, dirname, join } from "path";
import { stat } from "fs/promises";
import { expandTilde } from "../../utils/system/path";
import { logger } from "../../logger";
import { rofiConfirm } from "../../security/confirmation";
import { CancellationError } from "../../types";
import { handleFileManagement, parseQuotedArgs } from "./file-management";
import {
  atomicWriteFile,
  buildResult,
  humanSize,
  isDangerousPath,
  MAX_READ_BYTES,
  spawnSafe,
  validateNullBytes,
} from "./file-shared";
import type { ToolExecutionResult } from "../../types";

interface FileOpContext {
  operation: string;
  allArgs: string[];
  args: string[];
}

async function confirmDangerousPath(title: string, message: string): Promise<void> {
  await rofiConfirm(title, message, "high");
}

async function runFileCommand(
  action: string,
  command: string[],
  path: string,
  successMessage: string
): Promise<ToolExecutionResult> {
  const result = await spawnSafe(command);
  const cmdStr = command.join(" ");
  if (result.exitCode !== 0) {
    return buildResult(
      action,
      tf("error.with_message", { message: result.stderr.trim() || t("tool.result.command_failed") }),
      false,
      {
        command: cmdStr,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }
    );
  }
  return buildResult(action, successMessage, true, {
    command: cmdStr,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: 0,
  });
}

const fileHandlers: Record<string, (ctx: FileOpContext) => Promise<ToolExecutionResult>> = {
  create_dir: async ({ args }) => {
    if (!args[0]) {
      return buildResult("create_dir", t("tool.result.invalid_request"), false, {
        stderr: "Missing path",
        exitCode: 2,
      });
    }
    const command = ["mkdir", "-p", args[0]!];
    return runFileCommand("create_dir", command, args[0]!, tf("tool.result.folder_created", { path: args[0]! }));
  },

  delete: async ({ args }) => {
    if (!args[0]) {
      return buildResult("delete", t("tool.result.invalid_request"), false, {
        stderr: "Missing path",
        exitCode: 2,
      });
    }
    if (args[0] === "/" || args[0] === Bun.env.HOME) {
      return buildResult("delete", t("tool.result.invalid_request"), false, {
        stderr: "Dangerous operation cancelled",
        exitCode: 2,
      });
    }

    if (isDangerousPath(args[0])) {
      await confirmDangerousPath("Delete Operation", `Path: ${args[0]}\n\nThis is a critical system path!`);
    }

    const command = ["rm", "-rf", args[0]!];
    return runFileCommand("delete", command, args[0]!, tf("tool.result.deleted", { path: args[0]! }));
  },

  move: async ({ args }) => {
    if (args.length < 2) {
      return buildResult("move", t("tool.result.invalid_request"), false, {
        stderr: "Source and destination required",
        exitCode: 2,
      });
    }
    const src = args[0]!;
    const dest = args[1]!;
    if (!src || !dest) {
      return buildResult("move", t("tool.result.invalid_request"), false, {
        stderr: "Incomplete path",
        exitCode: 2,
      });
    }
    if (isDangerousPath(src) || isDangerousPath(dest)) {
      await confirmDangerousPath("Move Operation", `From: ${src}\nTo: ${dest}\n\nInvolves critical system path!`);
    }

    const command = ["mv", src, dest];
    return runFileCommand("move", command, dest, tf("tool.result.moved", { path: dest }));
  },

  copy: async ({ args }) => {
    if (args.length < 2) {
      return buildResult("copy", t("tool.result.invalid_request"), false, {
        stderr: "Source and destination required",
        exitCode: 2,
      });
    }
    const src = args[0]!;
    const dest = args[1]!;
    if (!src || !dest) {
      return buildResult("copy", t("tool.result.invalid_request"), false, {
        stderr: "Incomplete path",
        exitCode: 2,
      });
    }
    if (isDangerousPath(src) || isDangerousPath(dest)) {
      await confirmDangerousPath("Copy Operation", `From: ${src}\nTo: ${dest}\n\nInvolves critical system path!`);
    }

    const command = ["cp", "-r", src, dest];
    return runFileCommand("copy", command, dest, tf("tool.result.copied", { path: dest }));
  },

  rename: async ({ args }) => {
    if (args.length < 2) {
      return buildResult("rename", t("tool.result.invalid_request"), false, {
        stderr: "Source and new name required",
        exitCode: 2,
      });
    }
    const src = args[0]!;
    const newName = args[1]!;
    if (!src || !newName) {
      return buildResult("rename", t("tool.result.invalid_request"), false, {
        stderr: "Incomplete path",
        exitCode: 2,
      });
    }
    if (newName.includes("/") || newName.includes("\\")) {
      return buildResult("rename", t("tool.result.invalid_request"), false, {
        stderr: "New name must not contain path separators",
        exitCode: 2,
      });
    }

    const dest = join(dirname(src), newName);
    if (isDangerousPath(src) || isDangerousPath(dest)) {
      await confirmDangerousPath("Rename Operation", `From: ${src}\nTo: ${dest}\n\nInvolves critical system path!`);
    }

    const command = ["mv", src, dest];
    return runFileCommand("rename", command, dest, `✓ Renamed to "${dest}"`);
  },

  list: async ({ args }) => {
    const path = args[0] || ".";
    const command = ["ls", "-la", path];
    const result = await spawnSafe(command);
    const cmdStr = command.join(" ");
    if (result.exitCode !== 0) {
      return buildResult(
        "list",
        tf("error.with_message", { message: result.stderr.trim() || t("tool.result.command_failed") }),
        false,
        {
          command: cmdStr,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        }
      );
    }
    return buildResult("list", result.stdout, true, {
      command: cmdStr,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    });
  },

  read: async ({ args }) => {
    if (!args[0]) {
      return buildResult("read", t("tool.result.invalid_request"), false, {
        stderr: "Missing path",
        exitCode: 2,
      });
    }
    try {
      const file = Bun.file(args[0]);
      if (!(await file.exists())) {
        return buildResult("read", tf("error.with_message", { message: "File not found" }), false, {
          stderr: "File not found",
          exitCode: 404,
        });
      }
      if (file.size > MAX_READ_BYTES) {
        return buildResult(
          "read",
          tf("error.with_message", {
            message: `File is too large to read (${file.size} bytes; max ${MAX_READ_BYTES} bytes)`,
          }),
          false,
          {
            stderr: `File is too large to read (${file.size} bytes; max ${MAX_READ_BYTES} bytes)`,
            exitCode: 413,
          }
        );
      }
      const text = await file.text();
      return buildResult("read", text, true, { stdout: text, exitCode: 0 });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("files", `Read failed: ${err.message}`, err);
      return buildResult("read", tf("error.with_message", { message: err.message }), false, {
        stderr: err.message,
        exitCode: 1,
      });
    }
  },

  write: async ({ allArgs, args }) => {
    if (!args[0]) {
      return buildResult("write", t("tool.result.invalid_request"), false, {
        stderr: "Missing path",
        exitCode: 2,
      });
    }
    const path = args[0]!;
    if (isDangerousPath(path)) {
      await confirmDangerousPath("Write Operation", `Path: ${path}\n\nThis is a critical system path!`);
    }

    const content = allArgs.slice(2).join(" ");
    try {
      await atomicWriteFile(path, content);
      return buildResult("write", tf("tool.result.file_written", { path }), true, {
        stdout: content,
        exitCode: 0,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("files", `Write failed: ${err.message}`, err);
      return buildResult("write", tf("error.with_message", { message: err.message }), false, {
        stderr: err.message,
        exitCode: 1,
      });
    }
  },

  touch: async ({ args }) => {
    if (!args[0]) {
      return buildResult("touch", t("tool.result.invalid_request"), false, {
        stderr: "Missing path",
        exitCode: 2,
      });
    }
    const path = args[0]!;
    if (isDangerousPath(path)) {
      await confirmDangerousPath("Touch Operation", `Path: ${path}\n\nThis is a critical system path!`);
    }

    const command = ["touch", path];
    return runFileCommand("touch", command, path, `✓ Touched "${path}"`);
  },

  stat: async ({ args }) => {
    if (!args[0]) {
      return buildResult("stat", t("tool.result.invalid_request"), false, {
        stderr: "Missing path",
        exitCode: 2,
      });
    }
    try {
      const stats = await stat(args[0]);
      const info = {
        path: args[0],
        type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
        size: stats.size,
        humanSize: humanSize(stats.size),
        permissions: (stats.mode & 0o777).toString(8).padStart(3, "0"),
        owner: stats.uid,
        group: stats.gid,
        inode: stats.ino,
        created: stats.birthtime?.toISOString() ?? null,
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
      };
      const text = JSON.stringify(info, null, 2);
      return buildResult("stat", text, true, { stdout: text, exitCode: 0 });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("files", `Stat failed: ${err.message}`, err);
      return buildResult("stat", tf("error.with_message", { message: err.message }), false, {
        stderr: err.message,
        exitCode: 1,
      });
    }
  },

  chmod: async ({ args }) => {
    if (args.length < 2) {
      return buildResult("chmod", t("tool.result.invalid_request"), false, {
        stderr: "Path and mode required",
        exitCode: 2,
      });
    }
    const path = args[0]!;
    const mode = args[1]!;
    if (!/^[0-7]{3,4}$/.test(mode) && !/^[ugoa]*[+-=][rwxXst]*$/.test(mode)) {
      return buildResult("chmod", t("tool.result.invalid_request"), false, {
        stderr: "Invalid mode format",
        exitCode: 2,
      });
    }
    if (isDangerousPath(path)) {
      await confirmDangerousPath("Chmod Operation", `Path: ${path}\n\nThis is a critical system path!`);
    }

    const command = ["chmod", mode, path];
    return runFileCommand("chmod", command, path, `✓ Permissions changed for "${path}"`);
  },

  chown: async ({ args }) => {
    if (args.length < 2) {
      return buildResult("chown", t("tool.result.invalid_request"), false, {
        stderr: "Path and owner required",
        exitCode: 2,
      });
    }
    const path = args[0]!;
    const owner = args[1]!;
    if (!/^[a-zA-Z0-9_.-]+(:[a-zA-Z0-9_.-]+)?$/.test(owner)) {
      return buildResult("chown", t("tool.result.invalid_request"), false, {
        stderr: "Invalid owner format",
        exitCode: 2,
      });
    }
    if (isDangerousPath(path)) {
      await confirmDangerousPath("Chown Operation", `Path: ${path}\n\nThis is a critical system path!`);
    }

    const command = ["chown", owner, path];
    return runFileCommand("chown", command, path, `✓ Ownership changed for "${path}"`);
  },
};


export async function fileOp(operation: string): Promise<ToolExecutionResult> {
  logger.info("files", `Operation: ${operation}`);

  try {
    const advancedResult = await handleFileManagement(operation);
    if (advancedResult) {
      return advancedResult;
    }

    const allArgs = parseQuotedArgs(operation.trim());
    const nullByteError = validateNullBytes(allArgs, operation);
    if (nullByteError) {
      return nullByteError;
    }

    let args: string[];
    try {
      args = allArgs.slice(1).map(expandTilde);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildResult(operation.trim(), tf("error.with_message", { message }), false, {
        stderr: message,
        exitCode: 2,
      });
    }

    const cmd = allArgs[0]?.toLowerCase();
    const handler = cmd ? fileHandlers[cmd] : undefined;
    if (handler) {
      return await handler({ operation, allArgs, args });
    }

    return buildResult(
      operation.trim(),
      t("tool.result.invalid_request"),
      false,
      {
        stderr: "Unknown file action",
        exitCode: 2,
      }
    );
  } catch (error) {
    if (error instanceof CancellationError) {
      throw error;
    }
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("files", `File operation failed: ${err.message}`, err);
    return buildResult(operation.trim(), tf("error.with_message", { message: err.message }), false, {
      stderr: err.message,
      exitCode: 1,
    });
  }
}
