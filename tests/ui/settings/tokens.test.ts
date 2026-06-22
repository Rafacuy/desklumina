import { describe, test, expect } from "bun:test";
import { getColorTokens, resolveColorScheme } from "../../../src/ui/settings/tokens";

describe("getColorTokens", () => {
  test("returns light palette for light scheme", () => {
    const tokens = getColorTokens("light");
    expect(tokens.textPrimary).toBe("#1a1a1a");
    expect(tokens.accentPurple).toBe("#7F77DD");
  });

  test("returns dark palette for dark scheme", () => {
    const tokens = getColorTokens("dark");
    expect(tokens.textPrimary).toBe("#e8e8e8");
    expect(tokens.accentPurple).toBe("#9F97ED");
  });
});

describe("resolveColorScheme", () => {
  test("returns a valid scheme without throwing", async () => {
    const scheme = await resolveColorScheme();
    expect(scheme === "light" || scheme === "dark").toBe(true);
  });
});
