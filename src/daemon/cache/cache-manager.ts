import { ThemeCache } from "./theme-cache";
import { SettingsCache } from "./settings-cache";
import { AppsCache } from "./apps-cache";
import { ModelsCache } from "./models-cache";
import { I18nCache } from "./i18n-cache";
import { PromptCache } from "./prompt-cache";
import { RofiArgsCache } from "./rofi-args-cache";
import { logger } from "../../logger";

export type CacheName = "theme" | "settings" | "apps" | "models" | "i18n" | "prompt" | "rofiArgs";

export class CacheManager {
  readonly theme = new ThemeCache();
  readonly settings = new SettingsCache();
  readonly apps = new AppsCache();
  readonly models = new ModelsCache();
  readonly i18n = new I18nCache();
  readonly prompt = new PromptCache();
  readonly rofiArgs = new RofiArgsCache();

  async warmup(): Promise<void> {
    const lang = Bun.env.LANG?.split(".")[0]?.split("_")[0] ?? "en";
    await Promise.all([
      this.theme.getOrLoad().catch(e => logger.warn("cache", `theme warmup failed: ${e}`)),
      this.settings.getOrLoad().catch(e => logger.warn("cache", `settings warmup failed: ${e}`)),
      this.apps.getOrLoad().catch(e => logger.warn("cache", `apps warmup failed: ${e}`)),
      this.models.getOrLoad().catch(e => logger.warn("cache", `models warmup failed: ${e}`)),
      this.i18n.getOrLoad(lang).catch(e => logger.warn("cache", `i18n warmup failed: ${e}`)),
    ]);
    logger.info("cache", "All caches warmed");
  }

  async warmupHotCaches(): Promise<void> {
    await Promise.all([
      this.theme.getOrLoad().catch(e => logger.warn("cache", `theme warmup failed: ${e}`)),
      this.settings.getOrLoad().catch(e => logger.warn("cache", `settings warmup failed: ${e}`)),
    ]);
  }

  invalidate(name: CacheName): void {
    switch (name) {
      case "theme": this.theme.invalidate(); break;
      case "settings": this.settings.invalidate(); break;
      case "apps": this.apps.invalidate(); break;
      case "models": this.models.invalidate(); break;
      case "i18n": this.i18n.invalidate(); break;
      case "prompt": this.prompt.invalidate(); break;
      case "rofiArgs": this.rofiArgs.invalidate(); break;
    }
  }

  diag(): Record<string, unknown> {
    return {
      theme: this.theme.get() !== null,
      settings: this.settings.get() !== null,
      apps: this.apps.get() !== null,
      models: this.models.get() !== null,
    };
  }
}
