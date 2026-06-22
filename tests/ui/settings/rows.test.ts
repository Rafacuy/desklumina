import { describe, test, expect } from "bun:test";
import {
  renderTogglePill,
  renderNavRow,
  renderToggleRow,
  renderRow,
} from "../../../src/ui/settings/rows";
import { getColorTokens } from "../../../src/ui/settings/tokens";
import type { SettingsRow } from "../../../src/ui/settings/rows";

const fakeT = (key: string): string => {
  const map: Record<string, string> = {
    "common.on": "NYALA",
    "common.off": "MATI",
  };
  return map[key] ?? key;
};

describe("renderTogglePill", () => {
  const colors = getColorTokens("light");

  test("renders ON pill with background color", () => {
    const pill = renderTogglePill(true, colors, fakeT);
    expect(pill).toContain("NYALA");
    expect(pill).toContain(`background="${colors.pillOnBg}"`);
    expect(pill).toContain(`foreground="${colors.pillOnFg}"`);
  });

  test("renders OFF pill with background color", () => {
    const pill = renderTogglePill(false, colors, fakeT);
    expect(pill).toContain("MATI");
    expect(pill).toContain(`background="${colors.pillOffBg}"`);
    expect(pill).toContain(`foreground="${colors.pillOffFg}"`);
  });
});

describe("renderNavRow", () => {
  const colors = getColorTokens("light");

  test("renders a nav row with value and chevron", () => {
    const row: SettingsRow = { type: "nav", icon: "󰙨", label: "Persona", value: "default", panel: "persona" };
    const rendered = renderNavRow(row, colors);
    expect(rendered).toContain("Persona");
    expect(rendered).toContain("default");
    expect(rendered).toContain("›");
  });

  test("indents a depth-1 sub-row and dims it", () => {
    const row: SettingsRow = { type: "nav", icon: "", label: "Voice", panel: "tts-voice", depth: 1 };
    const rendered = renderNavRow(row, colors);
    expect(rendered).toStartWith("\u2002\u2002\u2002<span alpha=\"80%\">");
  });
});

describe("renderToggleRow", () => {
  const colors = getColorTokens("light");

  test("renders a toggle row with a pill", () => {
    const row: SettingsRow = { type: "toggle", icon: "󰔡", label: "TTS", key: "tts.enabled", value: true };
    const rendered = renderToggleRow(row, colors, fakeT);
    expect(rendered).toContain("TTS");
    expect(rendered).toContain("NYALA");
  });
});

describe("renderRow", () => {
  const colors = getColorTokens("light");

  test("dispatches to section renderer", () => {
    const row: SettingsRow = { type: "section", label: "AI" };
    expect(renderRow(row, colors, fakeT)).toContain("AI");
  });

  test("escapes HTML in labels", () => {
    const row: SettingsRow = { type: "nav", icon: "", label: "<b>bold</b>", panel: "x" };
    const rendered = renderNavRow(row, colors);
    expect(rendered).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(rendered).not.toContain("<b>bold</b>");
  });
});
