import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  spyOn,
  mock,
} from "bun:test";
import { Lumina } from "../src/core/lumina";
import { tokenManager } from "../src/core/services/token-manager";
import { logger } from "../src/logger";
import { settingsManager } from "../src/core/services/settings-manager";

// Mock the real streamGroq to simulate behavior without using mock.module on the whole file
import * as orchestratorModule from "../src/ai/runtime/orchestrator";

describe("Token Flow Integration", () => {
  let lumina: Lumina;

  beforeEach(() => {
    mock.restore();
    lumina = new Lumina();
    (tokenManager as any).usageHistory = [];
    tokenManager.setTpmLimit(30_000);
    // Reset any existing mocks
    if ((orchestratorModule.streamAI as any).mockRestore) {
      (orchestratorModule.streamAI as any).mockRestore();
    }
  });

  afterEach(() => {
    mock.restore();
    // wipe history so tests dont bleed into each other
    (tokenManager as any).usageHistory = [];
  });

  test("tracks tokens for successful chat interaction", async () => {
    const trackSpy = spyOn(tokenManager, "trackUsage");
    const streamSpy = spyOn(orchestratorModule, "streamAI").mockImplementation(
      async function* () {
        yield "Hello! How can I assist you today?";
        tokenManager.trackUsage(100);
      },
    );

    // We expect streamAI to be called and then it should call trackUsage
    await lumina.chat("Hello there");

    expect(trackSpy).toHaveBeenCalled();
    expect(tokenManager.getCurrentTPM()).toBeGreaterThan(0);

    trackSpy.mockRestore();
    streamSpy.mockRestore();
  });

  test("warns when approaching TPM limit", async () => {
    const warnSpy = spyOn(logger, "warn");
    const streamSpy = spyOn(orchestratorModule, "streamAI").mockImplementation(
      async function* () {
        yield "Sure, how can I help?";
        tokenManager.trackUsage(2058); // Total will be 27058
      },
    );

    // Fill up TPM usage to near limit (Limit is 30,000, Threshold is 24,000)
    tokenManager.trackUsage(25000);

    // This message itself triggers a warning via TokenManager.trackUsage when called internally or explicitly
    await lumina.chat("Another message");

    // Check if logger.warn was called by TokenManager
    expect(warnSpy).toHaveBeenCalledWith(
      "token-manager",
      expect.stringContaining("TPM Usage High"),
    );

    warnSpy.mockRestore();
    streamSpy.mockRestore();
  });
});
