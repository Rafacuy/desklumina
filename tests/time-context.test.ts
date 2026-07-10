import { describe, expect, test } from "bun:test";
import { getTimeBracket, getTimeContextLine, getDateContextLine } from "../src/utils/time-context";

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

  test("getDateContextLine includes weekday, full date and relative marker", () => {
    const today = new Date();
    const expected = `Local date: ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()]}, ${["January","February","March","April","May","June","July","August","September","October","November","December"][today.getMonth()]} ${today.getDate()}, ${today.getFullYear()} (today)`;
    expect(getDateContextLine(today)).toBe(expected);
  });

  test("getDateContextLine resolves relative days", () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    expect(getDateContextLine(tomorrow)).toContain("(tomorrow)");
    expect(getDateContextLine(yesterday)).toContain("(yesterday)");
  });
});
