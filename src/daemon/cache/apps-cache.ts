import { existsSync, statSync } from "fs";
import { join } from "path";

const APPS_PATH = join(Bun.env.HOME!, ".config/desklumina/src/config/apps.json");

interface AppsCacheState {
  apps: Record<string, string>;
  mtime: number;
}

export class AppsCache {
  private state: AppsCacheState | null = null;
  private loadPromise: Promise<Record<string, string>> | null = null;

  async getOrLoad(): Promise<Record<string, string>> {
    if (this.state && !this.isStale()) return this.state.apps;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.load();
    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  get(): Record<string, string> | null {
    return this.state?.apps ?? null;
  }

  invalidate(): void {
    this.state = null;
  }

  private isStale(): boolean {
    if (!this.state) return true;
    try {
      const stats = statSync(APPS_PATH);
      return stats.mtimeMs !== this.state.mtime;
    } catch {
      return true;
    }
  }

  private async load(): Promise<Record<string, string>> {
    if (!existsSync(APPS_PATH)) {
      this.state = { apps: {}, mtime: 0 };
      return {};
    }

    const raw = await Bun.file(APPS_PATH).text();
    const apps = JSON.parse(raw) as Record<string, string>;
    const stats = statSync(APPS_PATH);
    this.state = { apps, mtime: stats.mtimeMs };
    return apps;
  }
}
