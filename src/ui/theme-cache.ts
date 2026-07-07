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

function minifyRasi(src: string): string {
  const out: string[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src.charAt(i);

    if (ch === "/" && src.charAt(i + 1) === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }

    if (ch === "/" && src.charAt(i + 1) === "/") {
      const end = src.indexOf("\n", i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }

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

    if (ch === "\n") {
      out.push("\n");
      i++;
      while (i < src.length && /\s/.test(src.charAt(i))) i++;
      continue;
    }

    if (/[ \t]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[ \t]/.test(src.charAt(j))) j++;
      out.push(" ");
      i = j;
      continue;
    }

    out.push(ch);
    i++;
  }

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

export function setThemeMode(mode: "light" | "dark"): void {
  currentThemeMode = mode;
}

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

export function refreshThemeCache(): void {
  buildLightCache();
  buildDarkCache();
}
