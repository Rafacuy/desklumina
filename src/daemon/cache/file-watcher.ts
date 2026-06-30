import { watch, existsSync, type FSWatcher } from "fs";
import { join } from "path";
import type { CacheManager } from "./cache-manager";
import { logger } from "../../logger";

const CONFIG_DIR = join(Bun.env.HOME!, ".config/desklumina");
const LOCALES_DIR = join(CONFIG_DIR, "src/locales");
const DEBOUNCE_MS = 200;

const watchers: FSWatcher[] = [];
let configDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let localesDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleConfigEvent(filename: string | null, cacheManager: CacheManager): void {
  if (configDebounceTimer) clearTimeout(configDebounceTimer);
  configDebounceTimer = setTimeout(() => {
    const f = filename?.toString() ?? "";
    if (f.endsWith("lumina.rasi")) {
      cacheManager.invalidate("theme");
      logger.debug("watcher", `Invalidated theme cache: ${f}`);
    } else if (f === "settings.json") {
      cacheManager.invalidate("settings");
      logger.debug("watcher", `Invalidated settings cache: ${f}`);
    } else if (f === "apps.json" || f.endsWith("config/apps.json")) {
      cacheManager.invalidate("apps");
      logger.debug("watcher", `Invalidated apps cache: ${f}`);
    } else if (f === "models.json") {
      cacheManager.invalidate("models");
      logger.debug("watcher", `Invalidated models cache: ${f}`);
    }
  }, DEBOUNCE_MS);
}

function handleLocalesEvent(filename: string | null, cacheManager: CacheManager): void {
  if (localesDebounceTimer) clearTimeout(localesDebounceTimer);
  localesDebounceTimer = setTimeout(() => {
    cacheManager.invalidate("i18n");
    logger.debug("watcher", `Invalidated i18n cache: ${filename}`);
  }, DEBOUNCE_MS);
}

export function startFileWatcher(cacheManager: CacheManager): void {
  if (watchers.length > 0) return;

  try {
    const configWatcher = watch(CONFIG_DIR, (_event, filename) => {
      handleConfigEvent(filename, cacheManager);
    });
    watchers.push(configWatcher);

    if (existsSync(LOCALES_DIR)) {
      const localesWatcher = watch(LOCALES_DIR, (_event, filename) => {
        handleLocalesEvent(filename, cacheManager);
      });
      watchers.push(localesWatcher);
    }

    process.on("exit", () => stopFileWatcher());
    logger.info("watcher", `File watcher started on ${CONFIG_DIR}`);
  } catch (err) {
    logger.error("watcher", `Failed to start file watcher: ${err}`);
  }
}

export function stopFileWatcher(): void {
  if (configDebounceTimer) {
    clearTimeout(configDebounceTimer);
    configDebounceTimer = null;
  }
  if (localesDebounceTimer) {
    clearTimeout(localesDebounceTimer);
    localesDebounceTimer = null;
  }
  for (const w of watchers) {
    try { w.close(); } catch { /* already closed */ }
  }
  watchers.length = 0;
}
