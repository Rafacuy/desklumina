import { describe, test, expect, spyOn, afterEach } from "bun:test";
import { rofiConfirm } from "../src/security/confirmation";
import { settingsManager } from "../src/core/settings-manager";

describe("Security Confirmation", () => {
  afterEach(async () => {
    // Restore settings to default
    const settings = settingsManager.get();
    settings.features.dangerousCommandConfirmation = true;
    await settingsManager.save();
  });

  test("should throw error if rofi is not installed", async () => {
    // Mock Bun.which to return null
    const whichSpy = spyOn(Bun, "which").mockReturnValue(Promise.resolve(null) as any);
    
    try {
      await rofiConfirm("Test", "Message");
      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      expect(error.message).toContain("rofi is not installed");
    } finally {
      whichSpy.mockRestore();
    }
  });

  test("should not check for rofi if confirmation is disabled", async () => {
    const whichSpy = spyOn(Bun, "which");
    
    // Disable confirmation
    const settings = settingsManager.get();
    settings.features.dangerousCommandConfirmation = false;
    await settingsManager.save();

    const result = await rofiConfirm("Test", "Message");
    expect(result).toBe(true);
    expect(whichSpy).not.toHaveBeenCalled();
    
    whichSpy.mockRestore();
  });
});
