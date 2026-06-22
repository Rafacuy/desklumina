import { describe, test, expect } from "bun:test";
import { buildFooterHint } from "../../../src/ui/settings/footer";
import type { SettingsRow } from "../../../src/ui/settings/rows";

const fakeT = (key: string): string => {
  const map: Record<string, string> = {
    "settings.hint.open": "↵ Open",
    "settings.hint.toggle": "↵ Toggle",
    "settings.hint.close": "esc Close",
  };
  return map[key] ?? key;
};

describe("buildFooterHint", () => {
  test("nav row shows open hint", () => {
    const row: SettingsRow = { type: "nav", icon: "", label: "Persona", panel: "persona" };
    expect(buildFooterHint(row, fakeT)).toBe('<span size="small" alpha="55%">↵ Open   esc Close</span>');
  });

  test("toggle row shows toggle hint", () => {
    const row: SettingsRow = { type: "toggle", icon: "", label: "TTS", key: "tts.enabled", value: false };
    expect(buildFooterHint(row, fakeT)).toBe('<span size="small" alpha="55%">↵ Toggle   esc Close</span>');
  });

  test("section row shows close hint only", () => {
    const row: SettingsRow = { type: "section", label: "AI" };
    expect(buildFooterHint(row, fakeT)).toBe('<span size="small" alpha="55%">esc Close</span>');
  });
});
