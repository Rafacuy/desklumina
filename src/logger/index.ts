import { mkdir } from "node:fs/promises";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

const LOG_DIR = `${import.meta.dir}/../../logs`;
const ERROR_DIR = `${LOG_DIR}/errors`;

await mkdir(LOG_DIR, { recursive: true });
await mkdir(ERROR_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function formatLog(level: LogLevel, module: string, message: string) {
  return `[${timestamp()}] [${level}] ${module} → ${message}\n`;
}

async function writeLog(file: string, content: string) {
  await Bun.write(file, content, { createPath: true });
}

export const logger = {
  debug(module: string, message: string) {
    const log = formatLog("DEBUG", module, message);
    console.log(log.trim());
    Bun.write(`${LOG_DIR}/lumina.log`, log, { createPath: true });
  },

  info(module: string, message: string) {
    const log = formatLog("INFO", module, message);
    console.log(log.trim());
    Bun.write(`${LOG_DIR}/lumina.log`, log, { createPath: true });
  },

  warn(module: string, message: string) {
    const log = formatLog("WARN", module, message);
    console.warn(log.trim());
    Bun.write(`${LOG_DIR}/lumina.log`, log, { createPath: true });
  },

  error(module: string, message: string) {
    const log = formatLog("ERROR", module, message);
    console.error(log.trim());
    const date = new Date().toISOString().split("T")[0];
    Bun.write(`${ERROR_DIR}/${date}.log`, log, { createPath: true });
  },

  fatal(module: string, message: string): never {
    const log = formatLog("FATAL", module, message);
    console.error(log.trim());
    const date = new Date().toISOString().split("T")[0];
    Bun.write(`${ERROR_DIR}/${date}.log`, log, { createPath: true });
    process.exit(1);
  },
};
