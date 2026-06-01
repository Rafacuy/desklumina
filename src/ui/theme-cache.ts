import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const THEME_SOURCE = resolve(
  process.env.HOME ?? "/tmp",
  ".config/desklumina/src/ui/themes/lumina.rasi"
);
const CACHE_DIR = resolve("/tmp", "desklumina-cache");
const CACHE_PATH = resolve(CACHE_DIR, "lumina.min.rasi");

interface CacheState {
  mtime: number;
  size: number;
}

let cachedState: CacheState | null = null;

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

function buildCache(): void {
  if (!existsSync(THEME_SOURCE)) {
    throw new Error(`Theme source not found: ${THEME_SOURCE}`);
  }

  const raw = readFileSync(THEME_SOURCE, "utf-8");
  const minified = minifyRasi(raw);

  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  writeFileSync(CACHE_PATH, minified, "utf-8");

  const stats = statSync(THEME_SOURCE);
  cachedState = { mtime: stats.mtimeMs, size: stats.size };
}

/**
 * Check whether the cache is stale by comparing source file mtime/size,
 * This is safe even if the file is edited rapidly because mtime granularity
 * is millisecond-level on Linux filesystems
 */
function isStale(): boolean {
  if (!existsSync(CACHE_PATH)) return true;
  if (!cachedState) return true;

  try {
    const stats = statSync(THEME_SOURCE);
    return stats.mtimeMs !== cachedState.mtime || stats.size !== cachedState.size;
  } catch {
    return true;
  }
}

/**
 * Return the path to use for Rofi -theme argument.
 *
 * Automatically minifies the source theme into /tmp on first call and
 *refreshes it whenever the source file changes
 */
export function getThemePath(): string {
  if (isStale()) {
    buildCache();
  }
  return CACHE_PATH;
}

/**
 * Force an immediate rebuild of the cached theme.
 * Useful after programmatic edits or for benchmarkin
 */
export function refreshThemeCache(): void {
  buildCache();
}
