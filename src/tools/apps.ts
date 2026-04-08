import { logger } from "../logger";
import appsData from "../config/apps.json";
import type { ToolExecutionResult } from "../types";

const apps = appsData as Record<string, string>;

/**
 * Look up application command by alias
 */
export function lookup(alias: string): string | null {
  return apps[alias.toLowerCase()] || null;
}

/**
 * Launch an application by alias
 */
export async function launch(alias: string): Promise<ToolExecutionResult> {
  const normalizedAlias = alias.trim().toLowerCase();

  try {
    const command = lookup(normalizedAlias);

    if (!command) {
      const message = `❌ Unknown application alias: ${alias}`;
      logger.warn("apps", message);
      return {
        tool: "app",
        result: `${message}. Use a configured alias or the terminal tool for shell commands.`,
        success: false,
        normalizedArg: normalizedAlias,
        stderr: message,
        exitCode: 2,
      };
    }

    logger.info("apps", `Launching: ${normalizedAlias} → ${command}`);
    Bun.spawn(["bash", "-c", command], { detached: true, stdio: ["ignore", "ignore", "ignore"] });
    return {
      tool: "app",
      result: `${normalizedAlias} launched`,
      success: true,
      normalizedArg: normalizedAlias,
      command,
      stdout: `${normalizedAlias} launched`,
      exitCode: 0,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("apps", `Failed to launch ${normalizedAlias}: ${err.message}`, err);
    return {
      tool: "app",
      result: `❌ Error: ${err.message}`,
      success: false,
      normalizedArg: normalizedAlias,
      stderr: err.message,
      exitCode: 1,
    };
  }
}

/**
 * Get all available application aliases
 */
export function getAvailableAliases(): string[] {
  return Object.keys(apps);
}

/**
 * Get all application mappings
 */
export function getAllApps(): Record<string, string> {
  return { ...apps };
}
