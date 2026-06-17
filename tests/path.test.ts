import { describe, test, expect } from "bun:test";
import { expandTilde, normalizePath } from "../src/utils/system/path";

describe("Path Utilities", () => {
  test("expandTilde expands ~ to home directory", () => {
    const result = expandTilde("~/Documents");
    expect(result).toContain("/Documents");
    expect(result).not.toContain("~");
  });

  test("expandTilde handles paths without tilde", () => {
    const result = expandTilde("/absolute/path");
    expect(result).toBe("/absolute/path");
  });

  test("expandTilde throws when HOME is unset", () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    delete process.env.HOME;
    delete process.env.USERPROFILE;

    try {
      expect(() => expandTilde("~/Documents")).toThrow("HOME environment variable is not set");
    } finally {
      if (originalHome !== undefined) process.env.HOME = originalHome;
      if (originalUserProfile !== undefined) process.env.USERPROFILE = originalUserProfile;
    }
  });

  test("normalizePath converts backslashes to forward slashes", () => {
    const result = normalizePath("path\\to\\file");
    expect(result).toBe("path/to/file");
  });

  test("normalizePath handles already normalized paths", () => {
    const result = normalizePath("path/to/file");
    expect(result).toBe("path/to/file");
  });
});
