import { describe, test, expect, beforeEach } from "bun:test";
import { CacheManager } from "../src/daemon/cache/cache-manager";
import { ThemeCache } from "../src/daemon/cache/theme-cache";
import { SettingsCache } from "../src/daemon/cache/settings-cache";
import { AppsCache } from "../src/daemon/cache/apps-cache";
import { ModelsCache } from "../src/daemon/cache/models-cache";
import { I18nCache } from "../src/daemon/cache/i18n-cache";
import { PromptCache } from "../src/daemon/cache/prompt-cache";
import { RofiArgsCache } from "../src/daemon/cache/rofi-args-cache";

describe("CacheManager", () => {
  let cm: CacheManager;

  beforeEach(() => {
    cm = new CacheManager();
  });

  test("warmup populates all caches", async () => {
    await cm.warmup();
    expect(cm.settings.get()).not.toBeNull();
    expect(cm.apps.get()).not.toBeNull();
  });

  test("invalidate clears specific cache", async () => {
    await cm.warmup();
    expect(cm.settings.get()).not.toBeNull();
    cm.invalidate("settings");
    expect(cm.settings.get()).toBeNull();
  });

  test("diag returns cache status", async () => {
    await cm.warmup();
    const diag = cm.diag();
    expect(diag).toHaveProperty("theme");
    expect(diag).toHaveProperty("settings");
    expect(diag).toHaveProperty("apps");
    expect(diag).toHaveProperty("models");
  });
});

describe("SettingsCache", () => {
  test("getOrLoad returns settings object", async () => {
    const cache = new SettingsCache();
    const settings = await cache.getOrLoad();
    expect(settings).toHaveProperty("language");
    expect(settings).toHaveProperty("features");
  });

  test("get returns null before load", () => {
    const cache = new SettingsCache();
    expect(cache.get()).toBeNull();
  });

  test("invalidate clears cache", async () => {
    const cache = new SettingsCache();
    await cache.getOrLoad();
    expect(cache.get()).not.toBeNull();
    cache.invalidate();
    expect(cache.get()).toBeNull();
  });

  test("set updates cached value", async () => {
    const cache = new SettingsCache();
    await cache.getOrLoad();
    const current = cache.get()!;
    cache.set({ ...current, persona: "test" });
    expect(cache.get()!.persona).toBe("test");
  });
});

describe("AppsCache", () => {
  test("getOrLoad returns apps object", async () => {
    const cache = new AppsCache();
    const apps = await cache.getOrLoad();
    expect(typeof apps).toBe("object");
    expect(apps).toHaveProperty("terminal");
  });

  test("invalidate clears cache", async () => {
    const cache = new AppsCache();
    await cache.getOrLoad();
    cache.invalidate();
    expect(cache.get()).toBeNull();
  });
});

describe("PromptCache", () => {
  test("get returns null for missing key", () => {
    const cache = new PromptCache();
    expect(cache.get("persona", "en", "hash")).toBeNull();
  });

  test("set and get round-trip", () => {
    const cache = new PromptCache();
    cache.set("tsundere", "id", "abc", "You are a tsundere assistant");
    expect(cache.get("tsundere", "id", "abc")).toBe("You are a tsundere assistant");
  });

  test("invalidate clears all entries", () => {
    const cache = new PromptCache();
    cache.set("a", "en", "1", "prompt1");
    cache.set("b", "en", "2", "prompt2");
    cache.invalidate();
    expect(cache.get("a", "en", "1")).toBeNull();
    expect(cache.get("b", "en", "2")).toBeNull();
  });
});

describe("RofiArgsCache", () => {
  test("get returns null for missing key", () => {
    const cache = new RofiArgsCache();
    expect(cache.get("theme1")).toBeNull();
  });

  test("set and get round-trip", () => {
    const cache = new RofiArgsCache();
    cache.set("default", ["rofi", "-dmenu", "-theme", "/path/to/theme"]);
    expect(cache.get("default")).toEqual(["rofi", "-dmenu", "-theme", "/path/to/theme"]);
  });

  test("invalidate clears cache", () => {
    const cache = new RofiArgsCache();
    cache.set("key", ["arg1"]);
    cache.invalidate();
    expect(cache.get("key")).toBeNull();
  });
});

describe("I18nCache", () => {
  test("getOrLoad returns locale data", async () => {
    const cache = new I18nCache();
    const data = await cache.getOrLoad("en");
    expect(typeof data).toBe("object");
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });

  test("invalidate clears all locales", async () => {
    const cache = new I18nCache();
    await cache.getOrLoad("en");
    cache.invalidate();
    expect(cache.get("en")).toBeNull();
  });
});
