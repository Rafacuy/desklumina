import { existsSync, statSync } from "fs";
import { join } from "path";

const LOCALES_DIR = join(Bun.env.HOME!, ".config/desklumina/src/locales");

interface I18nCacheEntry {
  data: Record<string, string>;
  mtime: number;
}

export class I18nCache {
  private entries = new Map<string, I18nCacheEntry>();
  private loadPromises = new Map<string, Promise<Record<string, string>>>();

  async getOrLoad(locale: string): Promise<Record<string, string>> {
    const existing = this.entries.get(locale);
    if (existing && !this.isStale(locale, existing)) return existing.data;

    const inflight = this.loadPromises.get(locale);
    if (inflight) return inflight;

    const promise = this.load(locale);
    this.loadPromises.set(locale, promise);
    try {
      return await promise;
    } finally {
      this.loadPromises.delete(locale);
    }
  }

  get(locale: string): Record<string, string> | null {
    return this.entries.get(locale)?.data ?? null;
  }

  invalidate(): void {
    this.entries.clear();
  }

  private isStale(locale: string, entry: I18nCacheEntry): boolean {
    const path = join(LOCALES_DIR, `${locale}.json`);
    try {
      const stats = statSync(path);
      return stats.mtimeMs !== entry.mtime;
    } catch {
      return true;
    }
  }

  private async load(locale: string): Promise<Record<string, string>> {
    const path = join(LOCALES_DIR, `${locale}.json`);
    if (!existsSync(path)) {
      this.entries.set(locale, { data: {}, mtime: 0 });
      return {};
    }

    const raw = await Bun.file(path).text();
    const data = JSON.parse(raw) as Record<string, string>;
    const stats = statSync(path);
    this.entries.set(locale, { data, mtime: stats.mtimeMs });
    return data;
  }
}
