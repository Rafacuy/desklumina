import { describe, test, expect, spyOn, beforeEach } from "bun:test";
import { settingsManager } from "../src/core/settings-manager";
import * as fs from "fs";

describe("SettingsManager", () => {
  test("save uses atomic write (renameSync)", async () => {
    const renameSpy = spyOn(fs, "renameSync");
    
    await settingsManager.save();
    
    expect(renameSpy).toHaveBeenCalled();
    renameSpy.mockRestore();
  });

  test("toggleFeature triggers save", async () => {
    const saveSpy = spyOn(settingsManager, "save");
    
    settingsManager.toggleFeature("tts");
    
    expect(saveSpy).toHaveBeenCalled();
    saveSpy.mockRestore();
  });
});
