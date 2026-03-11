/**
 * Log viewer utility for viewing and managing logs
 */

import { readFileSync, existsSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LOG_DIR = join(homedir(), ".config/bspwm/agent/logs");
const ERROR_LOG = join(LOG_DIR, "error.log");
const GENERAL_LOG = join(LOG_DIR, "general.log");

export interface LogStats {
  errorCount: number;
  warningCount: number;
  lastError?: string;
  logSize: number;
}

/**
 * Get log file statistics
 */
export function getLogStats(): LogStats {
  const stats: LogStats = {
    errorCount: 0,
    warningCount: 0,
    logSize: 0,
  };

  if (!existsSync(ERROR_LOG)) return stats;

  try {
    const content = readFileSync(ERROR_LOG, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    
    stats.errorCount = lines.filter(l => l.includes("[ERROR]") || l.includes("[FATAL]")).length;
    stats.warningCount = lines.filter(l => l.includes("[WARN]")).length;
    stats.logSize = statSync(ERROR_LOG).size;
    
    if (lines.length > 0) {
      stats.lastError = lines[lines.length - 1];
    }
  } catch (err) {
    // Silent fail
  }

  return stats;
}

/**
 * Read last N lines from error log
 */
export function readErrorLog(lines: number = 50): string {
  if (!existsSync(ERROR_LOG)) return "No error log found";

  try {
    const content = readFileSync(ERROR_LOG, "utf-8");
    const allLines = content.split("\n").filter(l => l.trim());
    return allLines.slice(-lines).join("\n");
  } catch (err) {
    return `Failed to read error log: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Read last N lines from general log
 */
export function readGeneralLog(lines: number = 50): string {
  if (!existsSync(GENERAL_LOG)) return "No general log found";

  try {
    const content = readFileSync(GENERAL_LOG, "utf-8");
    const allLines = content.split("\n").filter(l => l.trim());
    return allLines.slice(-lines).join("\n");
  } catch (err) {
    return `Failed to read general log: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Clear log files
 */
export function clearLogs(): { success: boolean; message: string } {
  try {
    if (existsSync(ERROR_LOG)) unlinkSync(ERROR_LOG);
    if (existsSync(GENERAL_LOG)) unlinkSync(GENERAL_LOG);
    return { success: true, message: "Logs cleared successfully" };
  } catch (err) {
    return {
      success: false,
      message: `Failed to clear logs: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
