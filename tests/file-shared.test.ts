import { describe, test, expect } from "bun:test";
import {
  DANGEROUS_PATHS,
  humanSize,
  isDangerousPath,
  mapWithConcurrency,
  spawnSafe,
  validateNullBytes,
} from "../src/tools/frameworks/file-shared";

describe("file-shared helpers", () => {
  test("humanSize formats bytes", () => {
    expect(humanSize(0)).toBe("0 B");
    expect(humanSize(120)).toBe("120 B");
    expect(humanSize(1536)).toBe("1.5 KB");
    expect(humanSize(8_388_608)).toBe("8.0 MB");
    expect(humanSize(2_147_483_648)).toBe("2.0 GB");
  });

  test("isDangerousPath covers required system paths", () => {
    for (const path of DANGEROUS_PATHS) {
      expect(isDangerousPath(path)).toBe(true);
      if (path !== "/") {
        expect(isDangerousPath(`${path}/subdir`)).toBe(true);
      }
    }
    expect(isDangerousPath("/tmp")).toBe(false);
    expect(isDangerousPath("/home/user/file")).toBe(false);
  });

  test("validateNullBytes returns an error when null byte is present", () => {
    const error = validateNullBytes(["/tmp/file\0", "content"], "write /tmp/file\0");
    expect(error).not.toBeNull();
    expect(error?.success).toBe(false);
    expect(error?.stderr?.toLowerCase()).toContain("null byte");
  });

  test("validateNullBytes returns null for clean arguments", () => {
    const error = validateNullBytes(["/tmp/file", "content"], "write /tmp/file content");
    expect(error).toBeNull();
  });

  test("spawnSafe times out a long-running command", async () => {
    try {
      await spawnSafe(["sleep", "5"], { timeoutMs: 50 });
      expect(true).toBe(false);
    } catch (error) {
      expect(error instanceof Error && error.message).toContain("timed out");
    }
  });

  test("spawnSafe rejects arguments containing null bytes", async () => {
    await expect(spawnSafe(["echo", "hello\0world"])).rejects.toThrow("Null byte");
  });

  test("mapWithConcurrency limits concurrent executions", async () => {
    let running = 0;
    let maxRunning = 0;

    const results = await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      async (i) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        running--;
        return i * 2;
      },
      5
    );

    expect(maxRunning).toBeLessThanOrEqual(5);
    expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i * 2));
  });
});
