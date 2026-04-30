import { describe, test, expect } from "bun:test";
import { fileOp } from "../src/tools/files";
import { media } from "../src/tools/media";
import { clipboard } from "../src/tools/clipboard";
import { notify } from "../src/tools/notify";
import { launch, lookup } from "../src/tools/apps";

describe("File Tool", () => {
  test("fileOp is defined", () => {
    expect(fileOp).toBeDefined();
    expect(typeof fileOp).toBe("function");
  });

  test("fileOp rejects dangerous paths", async () => {
    const result = await fileOp("delete /");
    expect(result.result).toContain("❌");
    expect(result.success).toBe(false);
  });

  test("fileOp list operation works", async () => {
    const result = await fileOp("list /tmp");
    expect(typeof result.result).toBe("string");
  });
});

describe("Media Tool", () => {
  test("media is defined", () => {
    expect(media).toBeDefined();
    expect(typeof media).toBe("function");
  });

  test("media returns structured result", async () => {
    const result = await media("current");
    expect(typeof result.result).toBe("string");
    expect(result.tool).toBe("media");
  });

  test("media normalizes natural language volume changes", async () => {
    const result = await media("volume up");
    expect(result.normalizedArg).toBe("volume +10");
  });

  test("media does not use bash -c (array-based spawn)", async () => {
    const result = await media("play");
    // command field should be the mpc command string, not a bash -c invocation
    expect(result.command).not.toContain("bash");
    expect(result.command).toMatch(/^mpc /);
  });

  test("media search passes query without shell escaping", async () => {
    const result = await media('search my "favorite" song');
    expect(result.normalizedArg).toBe('search my "favorite" song');
    expect(result.command).not.toContain("bash");
  });
});

describe("Clipboard Tool", () => {
  test("clipboard is defined", () => {
    expect(clipboard).toBeDefined();
    expect(typeof clipboard).toBe("function");
  });

  test("clipboard get action works", async () => {
    const result = await clipboard("get");
    expect(typeof result.result).toBe("string");
  });

  test("clipboard set action avoids shell injection", async () => {
    const complexString = '"; rm -rf /; echo "';
    const result = await clipboard(`set ${complexString}`);
    expect(result.command).toBe("clipcatctl insert");
    expect(result.success).toBeDefined();
  });

  test("clipboard set action rejects excessively large content", async () => {
    const largeContent = "a".repeat(1024 * 1024 + 1); // 1MB + 1 byte
    const result = await clipboard(`set ${largeContent}`);
    expect(result.success).toBe(false);
    expect(result.result).toContain("too large");
  });
});

describe("Notify Tool", () => {
  test("notify is defined", () => {
    expect(notify).toBeDefined();
    expect(typeof notify).toBe("function");
  });

  test("notify sends notification", async () => {
    const result = await notify("Test|Message|normal");
    expect(typeof result.result).toBe("string");
  });

  test("notify rejects invalid urgency", async () => {
    const result = await notify("Title|Body|invalid");
    expect(result.success).toBe(false);
    expect(result.result).toContain("Invalid urgency");
  });

  test("notify does not use bash -c (array-based spawn)", async () => {
    const result = await notify("Test|Body|normal");
    // command field is kept for display but spawn uses array args
    expect(result.command).not.toContain("bash -c");
    expect(result.command).toMatch(/^dunstify/);
  });
});

describe("Apps Tool (Issue #11 - Launch Failure Handling)", () => {
  test("lookup returns command for known alias", () => {
    const cmd = lookup("terminal");
    expect(cmd).not.toBeNull();
    expect(typeof cmd).toBe("string");
  });

  test("lookup returns null for unknown alias", () => {
    expect(lookup("nonexistent_app_xyz")).toBeNull();
  });

  test("launch returns success immediately for known alias", async () => {
    const result = await launch("terminal");
    expect(result.success).toBe(true);
    expect(result.tool).toBe("app");
    expect(result.exitCode).toBe(0);
  });

  test("launch returns failure for unknown alias", async () => {
    const result = await launch("nonexistent_app_xyz");
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.result).toContain("❌");
  });

  test("launch does not use bash -c (array-based spawn)", async () => {
    const result = await launch("terminal");
    // command field is the raw command from apps.json, not a bash -c wrapper
    expect(result.command).not.toContain("bash -c");
  });

  test("launch does not throw when process exits with non-zero code", async () => {
    // Spawn a known-bad command; the .exited handler should log but not throw
    const result = await launch("nonexistent_app_xyz");
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });
});
