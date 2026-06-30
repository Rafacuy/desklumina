import { existsSync, statSync } from "fs";
import { join } from "path";
import type { Settings } from "../../types";
import { DEFAULT_SETTINGS } from "../../types";

const SETTINGS_PATH = join(Bun.env.HOME!, ".config/desklumina/settings.json");

interface SettingsCacheState {
  settings: Settings;
  mtime: number;
}

export class SettingsCache {
  private state: SettingsCacheState | null = null;
  private loadPromise: Promise<Settings> | null = null;

  async getOrLoad(): Promise<Settings> {
    if (this.state && !this.isStale()) return this.state.settings;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.load();
    try {
      return await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  get(): Settings | null {
    return this.state?.settings ?? null;
  }

  set(settings: Settings): void {
    this.state = {
      settings,
      mtime: this.state?.mtime ?? 0,
    };
  }

  invalidate(): void {
    this.state = null;
  }

  private isStale(): boolean {
    if (!this.state) return true;
    try {
      const stats = statSync(SETTINGS_PATH);
      return stats.mtimeMs !== this.state.mtime;
    } catch {
      return true;
    }
  }

  private async load(): Promise<Settings> {
    if (!existsSync(SETTINGS_PATH)) {
      const settings = { ...DEFAULT_SETTINGS };
      this.state = { settings, mtime: 0 };
      return settings;
    }

    const raw = await Bun.file(SETTINGS_PATH).text();
    const saved = JSON.parse(raw);
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      features: { ...DEFAULT_SETTINGS.features, ...(saved.features || {}) },
      tts: { ...DEFAULT_SETTINGS.tts, ...(saved.tts || {}) },
    };
    settings.tts.naturalVoices = {
      ...DEFAULT_SETTINGS.tts.naturalVoices,
      ...(saved.tts?.naturalVoices || {}),
    };

    const stats = statSync(SETTINGS_PATH);
    this.state = { settings, mtime: stats.mtimeMs };
    return settings;
  }
}
