import { describe, test, expect } from "bun:test";
import { fileOp } from "../src/tools/files";
import { media } from "../src/tools/media";
import { clipboard } from "../src/tools/clipboard";
import { notify } from "../src/tools/notify";

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
});
