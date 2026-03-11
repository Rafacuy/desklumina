/**
 * Logger module with file logging and error tracking
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
const LOG_DIR = join(homedir(), ".config/bspwm/agent/logs");
const ERROR_LOG = join(LOG_DIR, "error.log");
const GENERAL_LOG = join(LOG_DIR, "general.log");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

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

function writeToFile(logFile: string, message: string) {
  try {
    ensureLogDir();
    appendFileSync(logFile, message + "\n", "utf-8");
  } catch (err) {
    // Silent fail to prevent logging errors from breaking the app
  }
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
