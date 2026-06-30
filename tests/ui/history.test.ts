import { describe, expect, test } from "bun:test";
import { resolveHistorySelection } from "../../src/ui/history";

describe("history selection", () => {
  const rows = [
    `<span foreground="#7060CA">chat</span>`,
    `<span foreground="#7F776F">settings</span>`,
    `<span foreground="#E4A7A1">exit</span>`,
    `<span foreground="#A79F96">separator</span>`,
    `<span weight="bold" foreground="#2E2A26">You:</span> <span foreground="#2E2A26">hello</span>`,
  ];

  test("Tab on a rendered history row hides history without reusing Pango markup as input", () => {
    expect(resolveHistorySelection(rows[4]!, 10, rows)).toEqual({ action: "hide" });
  });

  test("Tab with typed text preserves the draft input", () => {
    expect(resolveHistorySelection("send this", 10, rows)).toEqual({
      action: "hide",
      input: "send this",
    });
  });
});
