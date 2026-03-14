import { describe, test, expect } from "bun:test";

describe("File Tool", () => {
  const { fileOp } = require("../src/tools/files");

  test("fileOp is defined", () => {
    expect(fileOp).toBeDefined();
    expect(typeof fileOp).toBe("function");
  });

  test("fileOp rejects dangerous paths", async () => {
    const result = await fileOp("delete /");
    expect(result).toContain("❌");
  });

  test("fileOp list operation works", async () => {
    const result = await fileOp("list /tmp");
    expect(typeof result).toBe("string");
  });
});

describe("BSPWM Tool", () => {
  const { bspwm } = require("../src/tools/bspwm");

  test("bspwm is defined", () => {
    expect(bspwm).toBeDefined();
    expect(typeof bspwm).toBe("function");
  });

  test("bspwm returns string result", async () => {
    const result = await bspwm("list_workspaces");
    expect(typeof result).toBe("string");
  });
});

describe("Media Tool", () => {
  const { media } = require("../src/tools/media");

  test("media is defined", () => {
    expect(media).toBeDefined();
    expect(typeof media).toBe("function");
  });

  test("media returns string result", async () => {
    const result = await media("current");
    expect(typeof result).toBe("string");
  });
});

describe("Clipboard Tool", () => {
  const { clipboard } = require("../src/tools/clipboard");

  test("clipboard is defined", () => {
    expect(clipboard).toBeDefined();
    expect(typeof clipboard).toBe("function");
  });

  test("clipboard get action works", async () => {
    const result = await clipboard("get");
    expect(typeof result).toBe("string");
  });
});

describe("Notify Tool", () => {
  const { notify } = require("../src/tools/notify");

  test("notify is defined", () => {
    expect(notify).toBeDefined();
    expect(typeof notify).toBe("function");
  });

  test("notify sends notification", async () => {
    const result = await notify("Test|Message|normal");
    expect(typeof result).toBe("string");
  });
});
