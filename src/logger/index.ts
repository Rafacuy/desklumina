/**
 * Logger module with file logging and error tracking
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync, statSync, renameSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
const LOG_DIR = join(homedir(), ".config/desklumina/logs");
const ERROR_LOG = join(LOG_DIR, "error.log");
const GENERAL_LOG = join(LOG_DIR, "general.log");
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_BACKUPS = 3;

const logQueues: Record<string, string[]> = {};
const logTimers: Record<string, Timer | null> = {};

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function rotateLogIfNeeded(logFile: string) {
  try {
    if (!existsSync(logFile)) return;
    const stats = statSync(logFile);
    if (stats.size < MAX_LOG_SIZE) return;

    // Rotate backups
    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      const oldName = `${logFile}.${i}`;
      const newName = `${logFile}.${i + 1}`;
      if (existsSync(oldName)) {
        try {
          renameSync(oldName, newName);
        } catch {
          unlinkSync(oldName); // If rename fails, just remove it
        }
      }
    }
    // Rename current log
    renameSync(logFile, `${logFile}.1`);
  } catch (err) {
    // Silent fail for rotation
  }
}

/** @internal - For testing only */
export function _flushAllLogs() {
  flushQueue(GENERAL_LOG);
  flushQueue(ERROR_LOG);
}

function flushQueue(logFile: string) {
  const messages = logQueues[logFile];
  if (!messages || messages.length === 0) return;
  
  logQueues[logFile] = [];
  logTimers[logFile] = null;

  try {
    ensureLogDir();
    rotateLogIfNeeded(logFile);
    appendFileSync(logFile, messages.join(""), "utf-8");
  } catch (err) {
    // Silent fail to prevent logging errors from breaking the app
  }
}

function writeToFile(logFile: string, message: string) {
  if (!logQueues[logFile]) logQueues[logFile] = [];
  logQueues[logFile].push(message + "\n");

  if (!logTimers[logFile]) {
    logTimers[logFile] = setTimeout(() => {
      flushQueue(logFile);
    }, 250);
  }
}

// Ensure logs are flushed on exit
process.on("exit", () => {
  flushQueue(GENERAL_LOG);
  flushQueue(ERROR_LOG);
});

function formatLevel(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    debug: "\x1b[36m",
    info: "\x1b[32m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    fatal: "\x1b[35m",
  };
  const reset = "\x1b[0m";
  return `${colors[level]}[${level.toUpperCase()}]${reset}`;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, module: string, message: string, error?: Error) {
  const timestamp = formatTimestamp();
  const consoleMsg = `${timestamp} ${formatLevel(level)} [${module}] ${message}`;
  const fileMsg = `${timestamp} [${level.toUpperCase()}] [${module}] ${message}`;

  // Console output
  if (level === "error" || level === "fatal") {
    console.error(consoleMsg);
  } else if (level === "warn") {
    console.warn(consoleMsg);
  } else {
    console.log(consoleMsg);
  }

  // File logging
  writeToFile(GENERAL_LOG, fileMsg);

  // Error-specific logging with stack trace
  if ((level === "error" || level === "fatal") && error) {
    const errorDetails = `${fileMsg}\nStack: ${error.stack || "No stack trace"}\n`;
    writeToFile(ERROR_LOG, errorDetails);
  } else if (level === "error" || level === "fatal") {
    writeToFile(ERROR_LOG, fileMsg);
  }
}

export const logger = {
  debug(module: string, message: string) {
    log("debug", module, message);
  },
  info(module: string, message: string) {
    log("info", module, message);
  },
  warn(module: string, message: string) {
    log("warn", module, message);
  },
  error(module: string, message: string, error?: Error) {
    log("error", module, message, error);
  },
  fatal(module: string, message: string, error?: Error) {
    log("fatal", module, message, error);
  },
  catchError(module: string, error: unknown): string {
    const err = error instanceof Error ? error : new Error(String(error));
    const msg = err.message || String(error);
    this.error(module, `Caught error: ${msg}`, err);
    return msg;
  },
};

export type { LogLevel };
