import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { settingsManager } from "../src/core/services/settings-manager";
import * as fs from "fs";

describe("SettingsManager", () => {
  let renameSpy: any;
  let writeSpy: any;

  afterEach(() => {
    if (renameSpy) {
      renameSpy.mockRestore();
    }
    if (writeSpy) {
      writeSpy.mockRestore();
    }
  });

  beforeEach(async () => {
    await settingsManager.flush().catch(() => {});
  });

  test("flush completes successfully", async () => {
    await settingsManager.flush();
  });

  test("flush uses atomic write operations", async () => {
    renameSpy = spyOn(fs, "renameSync");
    writeSpy = spyOn(Bun, "write" as any).mockResolvedValue(0 as any);

    settingsManager.set({ persona: "test" });
    await settingsManager.flush();

    expect(renameSpy).toHaveBeenCalled();
  });

  test("toggleFeature marks settings dirty", async () => {
    const flushSpy = spyOn(settingsManager, "flush");

    settingsManager.toggleFeature("tts");

    await Bun.sleep(600);
    expect(flushSpy).toHaveBeenCalled();
    flushSpy.mockRestore();
  });

  test("includes LTM defaults", () => {
    const settings = settingsManager.get();

    expect(settings.features.ltm).toBeBoolean();
    expect(settings.ltm.episodicCap).toBeGreaterThan(0);
    expect(settings.ltm.tokenBudget).toBe(600);
    expect(settings.ltm.dbPath).toContain("ltm.db");
    expect(settings.ltm.semanticRetrieval.enabled).toBe(true);
    expect(settings.ltm.semanticRetrieval.threshold).toBe(0.65);
    expect(settings.ltm.semanticRetrieval.topK).toBe(5);
  });

  test("setNaturalVoicesEnabled updates enabled state", () => {
    const before = settingsManager.get().tts.naturalVoices.enabled;
    settingsManager.setNaturalVoicesEnabled(!before);
    expect(settingsManager.get().tts.naturalVoices.enabled).toBe(!before);
    settingsManager.setNaturalVoicesEnabled(before);
  });

  test("setNaturalVoicesVolume clamps to 0-100", () => {
    settingsManager.setNaturalVoicesVolume(150);
    expect(settingsManager.get().tts.naturalVoices.volume).toBe(100);
    settingsManager.setNaturalVoicesVolume(-10);
    expect(settingsManager.get().tts.naturalVoices.volume).toBe(0);
    settingsManager.setNaturalVoicesVolume(50);
    expect(settingsManager.get().tts.naturalVoices.volume).toBe(50);
  });

  test("setNaturalVoicesLatencyMaskingEnabled updates state", () => {
    const before = settingsManager.get().tts.naturalVoices.latencyMasking?.enabled;
    settingsManager.setNaturalVoicesLatencyMaskingEnabled(!before);
    expect(settingsManager.get().tts.naturalVoices.latencyMasking?.enabled).toBe(!before);
    settingsManager.setNaturalVoicesLatencyMaskingEnabled(before);
  });

  test("setNaturalVoicesDisfluencyEnabled updates state", () => {
    const before = settingsManager.get().tts.naturalVoices.disfluency?.enabled;
    settingsManager.setNaturalVoicesDisfluencyEnabled(!before);
    expect(settingsManager.get().tts.naturalVoices.disfluency?.enabled).toBe(!before);
    settingsManager.setNaturalVoicesDisfluencyEnabled(before);
  });

});
