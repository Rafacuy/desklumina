import { describe, test, expect } from "bun:test";
import { escapeHtml } from "../src/utils/formatting/format";

describe("Pango Markup Escaping", () => {
  test("should handle the reported failing payload", () => {
    const input = "“Breathe” by Years&Years is a song that describes the struggle against anxiety...";
    const output = escapeHtml(input);
    expect(output).toBe("“Breathe” by Years&amp;Years is a song that describes the struggle against anxiety...");
  });

  test("should escape all unsafe characters", () => {
    const input = "Check this: <tag> & \"quotes\" 'single'";
    const output = escapeHtml(input);
    expect(output).toBe("Check this: &lt;tag&gt; &amp; &quot;quotes&quot; &apos;single&apos;");
  });

  test("should avoid double-escaping already escaped entities", () => {
    const input = "Already &amp; escaped &lt; and &gt; but not this &";
    const output = escapeHtml(input);
    expect(output).toBe("Already &amp; escaped &lt; and &gt; but not this &amp;");
  });

  test("should handle multiline content and mixed punctuation", () => {
    const input = `Line 1: Q&A
Line 2: <script>alert("!")</script>
Line 3: It's a "test"... (done)`;
    
    const output = escapeHtml(input);
    expect(output).toContain("Q&amp;A");
    expect(output).toContain("&lt;script&gt;");
    expect(output).toContain("&quot;!&quot;");
    expect(output).toContain("It&apos;s a &quot;test&quot;");
    expect(output.split('\n').length).toBe(3);
  });

  test("should handle numeric entities", () => {
    const input = "Decimal: &#123; Hex: &#xabc; Raw: &";
    const output = escapeHtml(input);
    expect(output).toBe("Decimal: &#123; Hex: &#xabc; Raw: &amp;");
  });

  test("should handle empty or null input", () => {
    expect(escapeHtml("")).toBe("");
    expect(escapeHtml(null as any)).toBe("");
  });
});
