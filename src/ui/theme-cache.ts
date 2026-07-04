import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const THEME_SOURCE_LIGHT = resolve(
  Bun.env.HOME ?? "/tmp",
  ".config/desklumina/src/ui/themes/lumina.rasi"
);
const THEME_SOURCE_DARK = resolve(
  Bun.env.HOME ?? "/tmp",
  ".config/desklumina/src/ui/themes/lumina-dark.rasi"
);
const CACHE_DIR = resolve("/tmp", "desklumina-cache");
const CACHE_PATH_LIGHT = resolve(CACHE_DIR, "lumina.min.rasi");
const CACHE_PATH_DARK = resolve(CACHE_DIR, "lumina-dark.min.rasi");

interface CacheState {
  mtime: number;
  size: number;
}

let cachedStateLight: CacheState | null = null;
let cachedStateDark: CacheState | null = null;

let currentThemeMode: "light" | "dark" = "light";

/**
 * Conservative Rasi minifier
 *
 *Rules applied:
 *1. Remove block comments 
 *2. Remove line comments 
 *3. Collapse runs of whitespace (outside quoted strings) into a single space
 *4. Trim leading/trailing whitespace.
 *
 * Quoted strings are preserved verbatim, including any whitespace inside them.
 */
function minifyRasi(src: string): string {
  const out: string[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src.charAt(i);

    //block comment
    if (ch === "/" && src.charAt(i + 1) === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }

    // Line comment
    if (ch === "/" && src.charAt(i + 1) === "/") {
      const end = src.indexOf("\n", i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }

    // Quoted string
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        const cj = src.charAt(j);
        if (cj === "\\") {
          j += 2;
        } else if (cj === '"') {
          j++;
          break;
        } else {
          j++;
        }
      }
      out.push(src.slice(i, j));
      i = j;
      continue;
    }

    // Newline preservation (block boundary)
    if (ch === "\n") {
      out.push("\n");
      i++;
      // Skip consecutive newlines
      while (i < src.length && /\s/.test(src.charAt(i))) i++;
      continue;
    }

    // Horizontal whitespace collapse
    if (/[ \t]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[ \t]/.test(src.charAt(j))) j++;
      out.push(" ");
      i = j;
      continue;
    }

    // Regular character
    out.push(ch);
    i++;
  }

  // Trim each line and remove empty ones
  return out
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

function buildCache(sourcePath: string, cachePath: string, cacheState: CacheState | null): void {
  if (!existsSync(sourcePath)) {
    throw new Error(`Theme source not found: ${sourcePath}`);
  }

  const raw = readFileSync(sourcePath, "utf-8");
  const minified = minifyRasi(raw);

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  writeFileSync(cachePath, minified, "utf-8");

  const stats = statSync(sourcePath);
  if (cacheState) {
    cacheState.mtime = stats.mtimeMs;
    cacheState.size = stats.size;
  }
}

function buildLightCache(): void {
  buildCache(THEME_SOURCE_LIGHT, CACHE_PATH_LIGHT, cachedStateLight);
}

function buildDarkCache(): void {
  buildCache(THEME_SOURCE_DARK, CACHE_PATH_DARK, cachedStateDark);
}

/**
 * Check whether the cache is stale by comparing source file mtime/size,
 * This is safe even if the file is edited rapidly because mtime granularity
 * is millisecond-level on Linux filesystems
 */
function isLightStale(): boolean {
  if (!existsSync(CACHE_PATH_LIGHT)) return true;
  if (!cachedStateLight) return true;

  try {
    const stats = statSync(THEME_SOURCE_LIGHT);
    return stats.mtimeMs !== cachedStateLight.mtime || stats.size !== cachedStateLight.size;
  } catch {
    return true;
  }
}

function isDarkStale(): boolean {
  if (!existsSync(CACHE_PATH_DARK)) return true;
  if (!cachedStateDark) return true;

  try {
    const stats = statSync(THEME_SOURCE_DARK);
    return stats.mtimeMs !== cachedStateDark.mtime || stats.size !== cachedStateDark.size;
  } catch {
    return true;
  }
}

/**
 * Set the current theme mode (light/dark)
 */
export function setThemeMode(mode: "light" | "dark"): void {
  currentThemeMode = mode;
}

/**
 * Return the path to use for Rofi -theme argument.
 *
 * Automatically minifies the source theme into /tmp on first call and
 *refreshes it whenever the source file changes
 */
export function getThemePath(): string {
  if (currentThemeMode === "dark") {
    if (isDarkStale()) {
      buildDarkCache();
    }
    return CACHE_PATH_DARK;
  } else {
    if (isLightStale()) {
      buildLightCache();
    }
    return CACHE_PATH_LIGHT;
  }
}

let themePathOverride: string | null = null;

export function setThemePathOverride(path: string | null): void {
  themePathOverride = path;
}

export function getThemePathWithOverride(): string {
  // If dark mode is enabled, always use dark theme (overrides daemon theme)
  if (currentThemeMode === "dark") {
    if (isDarkStale()) {
      buildDarkCache();
    }
    return CACHE_PATH_DARK;
  }
  
  // Otherwise, use daemon theme override if available, or default theme
  if (themePathOverride && existsSync(themePathOverride)) {
    return themePathOverride;
  }
  return getThemePath();
}

/**
 * Force an immediate rebuild of the cached theme.
 * Useful after programmatic edits or for benchmarkin
 */
export function refreshThemeCache(): void {
  buildLightCache();
  buildDarkCache();
}
