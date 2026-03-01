/**
 * Logger module
 */

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];

function getLevelPriority(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

function formatLevel(level: LogLevel): string {
  const colors: Record<LogLevel, string> = {
    debug: "\x1b[36m", // cyan
    info: "\x1b[32m",  // green
    warn: "\x1b[33m",  // yellow
    error: "\x1b[31m", // red
    fatal: "\x1b[35m", // magenta
  };
  const reset = "\x1b[0m";
  return `${colors[level]}[${level.toUpperCase()}]${reset}`;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug(module: string, message: string) {
    console.log(`${formatTimestamp()} ${formatLevel("debug")} [${module}] ${message}`);
  },
  info(module: string, message: string) {
    console.log(`${formatTimestamp()} ${formatLevel("info")} [${module}] ${message}`);
  },
  warn(module: string, message: string) {
    console.warn(`${formatTimestamp()} ${formatLevel("warn")} [${module}] ${message}`);
  },
  error(module: string, message: string) {
    console.error(`${formatTimestamp()} ${formatLevel("error")} [${module}] ${message}`);
  },
  fatal(module: string, message: string) {
    console.error(`${formatTimestamp()} ${formatLevel("fatal")} [${module}] ${message}`);
  },
};

export type { LogLevel };
