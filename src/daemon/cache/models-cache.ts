import { existsSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { loadModelsConfig, type ModelsConfig } from "../../ai/config/models-config";

const MODELS_PATH = join(homedir(), ".config/desklumina/models.json");

interface ModelsCacheState {
  config: ModelsConfig | null;
  mtime: number;
}

export class ModelsCache {
  private state: ModelsCacheState | null = null;
  private loadPromise: Promise<ModelsConfig | null> | null = null;

  async getOrLoad(): Promise<ModelsConfig | null> {
    if (this.state && !this.isStale()) return this.state.config;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.load();
    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  get(): ModelsConfig | null {
    return this.state?.config ?? null;
  }

  invalidate(): void {
    this.state = null;
  }

  private isStale(): boolean {
    if (!this.state) return true;
    if (!existsSync(MODELS_PATH)) return this.state.config !== null;
    try {
      const stats = statSync(MODELS_PATH);
      return stats.mtimeMs !== this.state.mtime;
    } catch {
      return true;
    }
  }

  private async load(): Promise<ModelsConfig | null> {
    const config = loadModelsConfig();
    const mtime = existsSync(MODELS_PATH) ? statSync(MODELS_PATH).mtimeMs : 0;
    this.state = { config, mtime };
    return config;
  }
}
