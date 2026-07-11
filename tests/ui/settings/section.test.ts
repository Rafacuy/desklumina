import { describe, test, expect } from "bun:test";
import { sectionHeader } from "../../../src/ui/settings/section";

describe("sectionHeader", () => {
  function visibleText(rendered: string): string {
    return rendered.replace(/<[^>]+>/g, "");
  }

  test("renders a centred section header with Pango markup", () => {
    const rendered = sectionHeader("AI", 42);

    expect(rendered).toContain("AI");
    expect(rendered).toContain("──");
    expect(rendered).toContain('<span size="small" weight="bold" alpha="60%">');
    expect(rendered).toContain('<span alpha="35%">');
  });

  test("balances dashes around the label", () => {
    const rendered = sectionHeader("TEST", 42);
    const stripped = visibleText(rendered);
    // Section headers intentionally leave two visible chars for breathing room.
    expect(Array.from(stripped).length).toBe(40);
  });

  test("uses code-point aware length for non-ASCII labels", () => {
    const rendered = sectionHeader("システム", 42);
    const stripped = visibleText(rendered);
    expect(Array.from(stripped).length).toBe(40);
  });
});
