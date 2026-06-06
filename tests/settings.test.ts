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
});
