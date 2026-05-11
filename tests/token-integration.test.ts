import { describe, test, expect, beforeEach, spyOn, mock } from "bun:test";
import { Lumina } from "../src/core/lumina";
import { tokenManager } from "../src/core/token-manager";
import { logger } from "../src/logger";

// Mock the real streamGroq to simulate behavior without using mock.module on the whole file
import * as groqModule from "../src/ai/groq";

describe("Token Flow Integration", () => {
  let lumina: Lumina;

  beforeEach(() => {
    lumina = new Lumina();
    (tokenManager as any).usageHistory = [];
    // Reset any existing mocks
    if ((groqModule.streamGroq as any).mockRestore) {
      (groqModule.streamGroq as any).mockRestore();
    }
  });

  test("tracks tokens for successful chat interaction", async () => {
    const trackSpy = spyOn(tokenManager, "trackUsage");
    
    // We expect streamGroq to be called and then it should call trackUsage
    await lumina.chat("Hello there");
    
    expect(trackSpy).toHaveBeenCalled();
    expect(tokenManager.getCurrentTPM()).toBeGreaterThan(0);
    
    trackSpy.mockRestore();
  });

  test("warns when approaching TPM limit", async () => {
    const warnSpy = spyOn(logger, "warn");
    
    // Fill up TPM usage to near limit (Limit is 30,000, Threshold is 24,000)
    tokenManager.trackUsage(25000);
    
    // This message itself triggers a warning via TokenManager.trackUsage when called internally or explicitly
    // Actually, buildSystemPrompt and chat calls don't trigger it BEFORE the call, 
    // but TokenManager.trackUsage logs it whenever it is called and TPM is high.
    
    await lumina.chat("Another message");
    
    // Check if logger.warn was called by TokenManager
    expect(warnSpy).toHaveBeenCalledWith("token-manager", expect.stringContaining("TPM Usage High"));
    
    warnSpy.mockRestore();
  });

  test("estimates tokens for large user input", async () => {
    const largeMessage = "A".repeat(10000); // ~2500 tokens
    const estimateSpy = spyOn(tokenManager, "estimateTokens");
    
    await lumina.chat(largeMessage);
    
    // It should be called for the user message during baseMessages construction in Lumina.chat
    // Wait, Lumina.chat doesn't call estimateTokens directly, Groq.streamGroq calls it via estimateTokens(messages)
    expect(estimateSpy).toHaveBeenCalled();
    expect(tokenManager.getCurrentTPM()).toBeGreaterThanOrEqual(2500);
    
    estimateSpy.mockRestore();
  });
});
