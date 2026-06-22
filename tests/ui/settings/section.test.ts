import { describe, test, expect } from "bun:test";
import { sectionHeader } from "../../../src/ui/settings/section";

describe("sectionHeader", () => {
  test("renders a centred section header with Pango markup", () => {
    const rendered = sectionHeader("AI", 42);

    expect(rendered).toContain("AI");
    expect(rendered).toContain("──");
    expect(rendered).toContain('<span size="small" weight="bold" alpha="60%">');
    expect(rendered).toContain('<span alpha="35%">');
  });

  test("balances dashes around the label", () => {
    const rendered = sectionHeader("TEST", 42);
    const stripped = rendered.replace(/<[^>]+>/g, "");
    // The spec formula yields panelWidth - 2 visible characters.
    expect(Array.from(stripped).length).toBe(40);
  });

  test("uses code-point aware length for non-ASCII labels", () => {
    const rendered = sectionHeader("システム", 42);
    const stripped = rendered.replace(/<[^>]+>/g, "");
    expect(Array.from(stripped).length).toBe(40);
  });
});
