import { homedir } from "os";
import { join } from "path";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { logger } from "../logger";

const SETTINGS_DIR = join(homedir(), ".config/bspwm/agent");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");

export class SettingsManager {
  private settings: Settings = DEFAULT_SETTINGS;
  private isLoaded = false;

  constructor() {
    this.load().catch(() => {});
  }

  private async load() {
    try {
      const file = Bun.file(SETTINGS_PATH);
      if (file.size > 0) {
        const data = await file.text();
        const saved = JSON.parse(data as any);
        if (saved && typeof saved === "object") {
          this.settings = { ...DEFAULT_SETTINGS, ...saved };
          this.isLoaded = true;
          return;
        }
      }
      await this.save();
    } catch (error) {
      logger.error("settings", `Failed to load: ${error}`);
      this.settings = DEFAULT_SETTINGS;
      await this.save();
    }
  }

  async save() {
    try {
      const settingsFile = Bun.file(SETTINGS_PATH);
      await Bun.write(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
      this.isLoaded = true;
    } catch (error) {
      logger.error("settings", `Failed to save: ${error}`);
    }
  }

  get(): Settings {
    return this.settings;
  }

  toggleFeature(feature: keyof Settings["features"]) {
    this.settings.features[feature] = !this.settings.features[feature];
    this.save();
  }

  setTTSVoice(voiceId: string) {
    this.settings.tts.voiceId = voiceId;
    this.save().catch(() => {});
  }

  setTTSSpeed(speed: number) {
    this.settings.tts.speed = Math.max(0.5, Math.min(2.0, speed));
    this.save().catch(() => {});
  }
}

export const settingsManager = new SettingsManager();
