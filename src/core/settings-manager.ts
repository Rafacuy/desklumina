import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from "fs";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import { logger } from "../logger";
import { setLang } from "../utils/i18n";

const SETTINGS_DIR = join(homedir(), ".config/desklumina");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");

export class SettingsManager {
  private settings: Settings = DEFAULT_SETTINGS;
  private savePromise: Promise<void> = Promise.resolve();

  constructor() {
    this.ensureDir();
    this.load();
  }

  private ensureDir() {
    try {
      if (!existsSync(SETTINGS_DIR)) {
        mkdirSync(SETTINGS_DIR, { recursive: true });
      }
    } catch (error) {
      console.error(`Failed to create settings directory: ${error}`);
    }
  }

  private load() {
    try {
      if (existsSync(SETTINGS_PATH)) {
        const data = readFileSync(SETTINGS_PATH, "utf-8");
        const saved = JSON.parse(data);
        if (saved && typeof saved === "object") {
          this.settings = { ...DEFAULT_SETTINGS, ...saved };
          // Sync language with i18n IMMEDIATELY to avoid race conditions
          if (this.settings.language) {
            setLang(this.settings.language);
          }
          return;
        }
      }
      this.saveSync();
    } catch (error) {
      logger.error("settings", `Failed to load: ${error}`);
      this.settings = DEFAULT_SETTINGS;
      this.saveSync();
    }
  }

  private saveSync() {
    try {
      this.ensureDir();
      const tempPath = `${SETTINGS_PATH}.tmp`;
      writeFileSync(tempPath, JSON.stringify(this.settings, null, 2));
      renameSync(tempPath, SETTINGS_PATH);
    } catch (error) {
      logger.error("settings", `Failed to saveSync: ${error}`);
    }
  }

  async save() {
    this.savePromise = this.savePromise.then(async () => {
      try {
        this.ensureDir();
        const tempPath = `${SETTINGS_PATH}.tmp`;
        await Bun.write(tempPath, JSON.stringify(this.settings, null, 2));
        renameSync(tempPath, SETTINGS_PATH);
      } catch (error) {
        logger.error("settings", `Failed to save: ${error}`);
      }
    });
    return this.savePromise;
  }

  get(): Settings {
    return this.settings;
  }

  toggleFeature(feature: keyof Settings["features"]) {
    this.settings.features[feature] = !this.settings.features[feature];
    this.save().catch(() => {});
  }
  
  setLanguage(lang: "id" | "en") {
    this.settings.language = lang;
    setLang(lang);
    
    // Auto-switch TTS voice based on language
    if (lang === "id") {
      this.settings.tts.voiceId = "id-ID-GadisNeural";
    } else if (lang === "en") {
      this.settings.tts.voiceId = "en-US-AvaNeural";
    }
    
    this.save().catch(() => {});
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
