import { mkdir, readFile, stat, utimes, writeFile } from "fs/promises";
import { resolve } from "path";

const THEME_SOURCE_LIGHT = resolve(
  Bun.env.HOME ?? "/tmp",
  ".config/desklumina/src/ui/themes/lumina.rasi"
);

const THEME_SOURCE_DARK = resolve(
  Bun.env.HOME ?? "/tmp",
  ".config/desklumina/src/ui/themes/lumina-dark.rasi"
);

const ICON_ABSOLUTE_PATH = resolve(
  Bun.env.HOME ?? "/tmp",
  ".config/desklumina/assets/logo/lumina-logo.png"
);

const CACHE_DIR = resolve("/tmp", "desklumina-cache");
const CACHE_PATH_LIGHT = resolve(CACHE_DIR, "lumina.min.rasi");
const CACHE_PATH_DARK = resolve(CACHE_DIR, "lumina-dark.min.rasi");

let currentThemeMode: "light" | "dark" = "light";

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function buildCache(sourcePath: string, cachePath: string): Promise<void> {
  if (!(await pathExists(sourcePath))) {
    throw new Error(`Theme source not found: ${sourcePath}`);
  }

  const raw = await readFile(sourcePath, "utf-8");
  const resolved = raw.replace(
    '"assets/logo/lumina-logo.png"',
    `"${ICON_ABSOLUTE_PATH}"`
  );

  if (!(await pathExists(CACHE_DIR))) {
    await mkdir(CACHE_DIR, { recursive: true });
  }

  await writeFile(cachePath, resolved, "utf-8");

   // set the cache file's mtime to match the source's (not "now"). the on-disk
   // cache is the only thing we can trust for staleness checks bc desklumina is
   // a one-shot deal, every hotkey press wipes in-mem state so we can't tell
   // "oh we built this already". file mtimes survive the restart, that's the only
   // check that actually works across presses
  const sourceStats = await stat(sourcePath);
  await utimes(cachePath, sourceStats.atime, sourceStats.mtime);
}

async function buildLightCache(): Promise<void> {
  await buildCache(THEME_SOURCE_LIGHT, CACHE_PATH_LIGHT);
}

async function buildDarkCache(): Promise<void> {
  await buildCache(THEME_SOURCE_DARK, CACHE_PATH_DARK);
}

async function isCacheStale(sourcePath: string, cachePath: string): Promise<boolean> {
  if (!(await pathExists(cachePath))) return true;

  try {
    const [sourceStats, cacheStats] = await Promise.all([
      stat(sourcePath),
      stat(cachePath),
    ]);
    // Stale only if the source was modified after the cache was built.
    // this works across restart since it just looks at file timestamps,
    // not any in-mem state that got dropped on relaunch
    return sourceStats.mtimeMs > cacheStats.mtimeMs;
  } catch {
    return true;
  }
}

async function isLightStale(): Promise<boolean> {
  return isCacheStale(THEME_SOURCE_LIGHT, CACHE_PATH_LIGHT);
}

async function isDarkStale(): Promise<boolean> {
  return isCacheStale(THEME_SOURCE_DARK, CACHE_PATH_DARK);
}

export function setThemeMode(mode: "light" | "dark"): void {
  currentThemeMode = mode;
}

export async function getThemePath(): Promise<string> {
  if (currentThemeMode === "dark") {
    if (await isDarkStale()) {
      await buildDarkCache();
    }
    return CACHE_PATH_DARK;
  } else {
    if (await isLightStale()) {
      await buildLightCache();
    }
    return CACHE_PATH_LIGHT;
  }
}

export async function refreshThemeCache(): Promise<void> {
  await buildLightCache();
  await buildDarkCache();
}
