import { logger } from "../logger";
import { checkDangerousCommand } from "../security/dangerous-commands";
import { rofiConfirm } from "../security/confirmation";
import appsData from "../config/apps.json";

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
export async function launch(alias: string): Promise<void> {
  try {
    const command = lookup(alias);

    if (!command) {
      logger.warn("apps", `Alias tidak ditemukan: ${alias}, fallback ke terminal`);

      const dangerous = checkDangerousCommand(alias);
      if (dangerous) {
        const confirmed = await rofiConfirm(
          `${dangerous.description}`,
          `Perintah: ${alias}\n\nTingkat Bahaya: ${dangerous.severity.toUpperCase()}`,
          dangerous.severity
        );

        if (!confirmed) {
          logger.info("apps", `Perintah berbahaya dibatalkan pengguna`);
          return;
        }
      }

      Bun.spawn(["bash", "-c", alias], { detached: true, stdio: ["ignore", "ignore", "ignore"] });
      return;
    }

    logger.info("apps", `Meluncurkan: ${alias} → ${command}`);
    Bun.spawn(["bash", "-c", command], { detached: true, stdio: ["ignore", "ignore", "ignore"] });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("apps", `Failed to launch ${alias}: ${err.message}`, err);
    throw err;
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
