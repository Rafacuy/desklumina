import { existsSync, mkdirSync, statSync } from "fs";
import { resolve, dirname } from "path";

const THEME_SOURCE = resolve(
  process.env.HOME ?? "/tmp",
  ".config/desklumina/src/ui/themes/lumina.rasi"
);

function getCachePath(): string {
  const xdgCache = process.env.XDG_CACHE_HOME || resolve(process.env.HOME ?? "/tmp", ".cache");
  return resolve(xdgCache, "desklumina/lumina.min.rasi");
}

interface ThemeCacheState {
  path: string;
  mtime: number;
  size: number;
  minified: string;
}

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

export class ThemeCache {
  private state: ThemeCacheState | null = null;
  private loadPromise: Promise<string> | null = null;

  async getOrLoad(): Promise<string> {
    if (this.state && !this.isStale()) return this.state.path;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.load();
    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  get(): ThemeCacheState | null {
    return this.state;
  }

  invalidate(): void {
    this.state = null;
  }

  private isStale(): boolean {
    if (!this.state) return true;
    try {
      const stats = statSync(THEME_SOURCE);
      return stats.mtimeMs !== this.state.mtime || stats.size !== this.state.size;
    } catch {
      return true;
    }
  }

  private async load(): Promise<string> {
    if (!existsSync(THEME_SOURCE)) {
      throw new Error(`Theme source not found: ${THEME_SOURCE}`);
    }

    const raw = await Bun.file(THEME_SOURCE).text();
    const minified = minifyRasi(raw);

    const cachePath = getCachePath();
    const cacheDir = dirname(cachePath);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    await Bun.write(cachePath, minified);

    const stats = statSync(THEME_SOURCE);
    this.state = {
      path: cachePath,
      mtime: stats.mtimeMs,
      size: stats.size,
      minified,
    };

    return cachePath;
  }
}
