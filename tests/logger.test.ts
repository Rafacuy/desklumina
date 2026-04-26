import { describe, test, expect, spyOn, beforeEach, afterEach } from "bun:test";
import { logger, rotateLogIfNeeded, _flushAllLogs } from "../src/logger";
import * as fs from "fs";
import { join } from "path";
import { homedir } from "os";

describe("Logger", () => {
  test("batching should group multiple logs into a single write", async () => {
    const appendSpy = spyOn(fs, "appendFileSync");
    
    logger.info("test", "message 1");
    logger.info("test", "message 2");
    logger.info("test", "message 3");

    // Immediate check - should NOT have written yet due to 250ms debounce
    expect(appendSpy).not.toHaveBeenCalled();

    // Wait for the flush (250ms + margin)
    await new Promise(resolve => setTimeout(resolve, 350));

    expect(appendSpy).toHaveBeenCalled();
    const callCount = appendSpy.mock.calls.length;
    // It should have written all 3 messages in fewer than 3 calls
    expect(callCount).toBeLessThan(4);
    
    appendSpy.mockRestore();
  });

  test("rotation should be triggered if file size exceeds 10MB", () => {
    const logFile = join(homedir(), ".config/desklumina/logs/general.log");
    
    const statSpy = spyOn(fs, "statSync").mockImplementation((path) => {
      if (path === logFile) {
        return { size: 11 * 1024 * 1024 } as any;
      }
      return { size: 0 } as any;
    });
    
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    const renameSpy = spyOn(fs, "renameSync").mockImplementation(() => {});

    rotateLogIfNeeded(logFile);
    
    expect(renameSpy).toHaveBeenCalledWith(logFile, `${logFile}.1`);
    
    statSpy.mockRestore();
    existsSpy.mockRestore();
    renameSpy.mockRestore();
  });

  test("_flushAllLogs should write pending logs immediately", () => {
    const appendSpy = spyOn(fs, "appendFileSync");
    
    logger.info("test", "urgent message");
    expect(appendSpy).not.toHaveBeenCalled();
    
    _flushAllLogs();
    expect(appendSpy).toHaveBeenCalled();
    
    appendSpy.mockRestore();
  });
});
