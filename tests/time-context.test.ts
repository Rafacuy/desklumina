import { describe, expect, test } from "bun:test";
import { getTimeBracket, getTimeContextLine } from "../src/utils/time-context";

describe("time context", () => {
  test("getTimeBracket returns expected coarse labels", () => {
    expect(getTimeBracket(3)).toBe("late night");
    expect(getTimeBracket(9)).toBe("morning");
    expect(getTimeBracket(23)).toBe("late night");
    expect(getTimeBracket(0)).toBe("late night");
  });

  test("getTimeContextLine is deterministic for a given Date", () => {
    const date = new Date(2026, 6, 9, 23, 42);
    expect(getTimeContextLine(date)).toBe("Local time: 23:42 (late night)");
    expect(getTimeContextLine(date)).toBe("Local time: 23:42 (late night)");
  });
});
