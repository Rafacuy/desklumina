import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { settingsManager } from "../src/core/settings-manager";
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
    // Ensure previous async saves are complete before running tests
    await settingsManager.save().catch(() => {});
  });

  test("save completes successfully", async () => {
    // Simply verify that save() completes without error
    await settingsManager.save();
    // No throw means success
  });

  test("save uses atomic write operations", async () => {
    // Spy on renameSync before calling save
    renameSpy = spyOn(fs, "renameSync");
    writeSpy = spyOn(Bun, "write" as any).mockResolvedValue(0 as any);
    
    await settingsManager.save();
    
    // Verify that atomic rename was called (indicates atomic write pattern)
    expect(renameSpy).toHaveBeenCalled();
  });

  test("toggleFeature triggers save", async () => {
    const saveSpy = spyOn(settingsManager, "save");
    
    settingsManager.toggleFeature("tts");
    
    expect(saveSpy).toHaveBeenCalled();
    saveSpy.mockRestore();
  });
});
