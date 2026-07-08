import { describe, expect, test } from "bun:test";
import { rm, stat } from "fs/promises";
import { getThemePath, setThemeMode } from "../../src/ui/theme-cache";

describe("Theme Cache", () => {
  test("getThemePath does not rebuild an unchanged light theme cache", async () => {
    setThemeMode("light");

    const cachePath = "/tmp/desklumina-cache/lumina.min.rasi";
    await rm(cachePath, { force: true });

    const firstPath = await getThemePath();
    const firstStats = await stat(firstPath);

    await Bun.sleep(50);

    const secondPath = await getThemePath();
    const secondStats = await stat(secondPath);

    expect(secondPath).toBe(firstPath);
    expect(secondStats.mtimeMs).toBe(firstStats.mtimeMs);
    expect(secondStats.size).toBe(firstStats.size);
  });

  test("theme mode selects the matching cache path", async () => {
    setThemeMode("dark");
    expect(await getThemePath()).toBe("/tmp/desklumina-cache/lumina-dark.min.rasi");

    setThemeMode("light");
    expect(await getThemePath()).toBe("/tmp/desklumina-cache/lumina.min.rasi");
  });
});
