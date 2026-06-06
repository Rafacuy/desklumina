import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, mkdirSync, renameSync } from "fs";
import type { Settings } from "../../types";
import { DEFAULT_SETTINGS } from "../../types";
import { logger } from "../../logger";
import { setLang } from "../../utils/localization/i18n";

const SETTINGS_DIR = join(homedir(), ".config/desklumina");
const SETTINGS_PATH = join(SETTINGS_DIR, "settings.json");
const FLUSH_DEBOUNCE_MS = 500;

export class SettingsManager {
  private static listenersInstalled = false;
  private settings: Settings = DEFAULT_SETTINGS;
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor() {
    this.ensureDir();
    this.load();
    this.installFlushOnExit();
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
          this.settings.features = { ...DEFAULT_SETTINGS.features, ...(saved.features || {}) };
          this.settings.tts = { ...DEFAULT_SETTINGS.tts, ...(saved.tts || {}) };

          if (this.settings.language) {
            setLang(this.settings.language);
          }
          return;
        }
      }
      this.scheduleFlush();
    } catch (error) {
      logger.error("settings", `Failed to load: ${error}`);
      this.settings = DEFAULT_SETTINGS;
      this.scheduleFlush();
    }
  }

  private installFlushOnExit(): void {
    if (SettingsManager.listenersInstalled) return;
    SettingsManager.listenersInstalled = true;

    const flushSync = () => {
      if (!this.dirty) return;
      try {
        this.ensureDir();
        const tempPath = `${SETTINGS_PATH}.tmp`;
        const { writeFileSync } = require("fs");
        writeFileSync(tempPath, JSON.stringify(this.settings, null, 2));
        renameSync(tempPath, SETTINGS_PATH);
        this.dirty = false;
      } catch {
        // best-effort on exit
      }
    };

    process.on("exit", flushSync);
    process.on("SIGTERM", flushSync);
    process.on("SIGINT", flushSync);
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(() => {});
    }, FLUSH_DEBOUNCE_MS);
  }

  async flush(): Promise<void> {
    if (!this.dirty) return this.flushPromise;

    this.flushPromise = this.flushPromise.then(async () => {
      if (!this.dirty) return;
      try {
        this.ensureDir();
        const tempPath = `${SETTINGS_PATH}.tmp`;
        await Bun.write(tempPath, JSON.stringify(this.settings, null, 2));
        renameSync(tempPath, SETTINGS_PATH);
        this.dirty = false;
      } catch (error) {
        logger.error("settings", `Failed to flush: ${error}`);
      }
    });
    return this.flushPromise;
  }

  get(): Settings {
    return this.settings;
  }

  async save(): Promise<void> {
    this.dirty = true;
    await this.flush();
  }

  set(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    this.scheduleFlush();
  }

  toggleFeature(feature: keyof Settings["features"]) {
    this.settings.features[feature] = !this.settings.features[feature];
    this.scheduleFlush();
  }

  setLanguage(lang: "id" | "en" | "ja") {
    this.settings.language = lang;
    setLang(lang);

    if (lang === "id") {
      this.settings.tts.voiceId = "id-ID-GadisNeural";
    } else if (lang === "en") {
      this.settings.tts.voiceId = "en-US-AvaNeural";
    } else if (lang === "ja") {
      this.settings.tts.voiceId = "ja-JP-NanamiNeural";
    }

    this.scheduleFlush();
  }

  setTTSVoice(voiceId: string) {
    this.settings.tts.voiceId = voiceId;
    this.scheduleFlush();
  }

  setTTSSpeed(speed: number) {
    this.settings.tts.speed = Math.max(0.5, Math.min(2.0, speed));
    this.scheduleFlush();
  }

  setPersona(persona: string) {
    this.settings.persona = persona;
    this.scheduleFlush();
  }
}

export const settingsManager = new SettingsManager();
