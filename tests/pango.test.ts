import { expect, test, describe } from "bun:test";
import { markdownToPango } from "../src/utils/pango";

describe("markdownToPango", () => {
  test("escapes unsafe characters", () => {
    const input = "Use < and > safely";
    const expected = "Use &lt; and &gt; safely";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("converts bold text", () => {
    const input = "This is **bold** text";
    const expected = "This is <b>bold</b> text";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("converts italic text", () => {
    const input = "This is *italic* and _also italic_ text";
    const expected = "This is <i>italic</i> and <i>also italic</i> text";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("converts inline code", () => {
    const input = "Run `bun test` to test";
    const expected = "Run <tt>bun test</tt> to test";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("converts headings", () => {
    const input = "# Main Title\n## Sub Title";
    const expected = '<span weight="bold" size="large">Main Title</span>\n<span weight="bold" size="large">Sub Title</span>';
    expect(markdownToPango(input)).toBe(expected);
  });

  test("converts bullet lists", () => {
    const input = "- Item 1\n* Item 2\n  - Subitem";
    const expected = "  • Item 1\n  • Item 2\n    • Subitem";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles multiline blocks and malformed markdown safely", () => {
    const input = "Some **unclosed bold text";
    const expected = "Some **unclosed bold text";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles nested formatting", () => {
    const input = "**Bold and *italic* together**";
    const expected = "<b>Bold and <i>italic</i> together</b>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles multiline code blocks", () => {
    const input = "```typescript\nconst x = 1;\n```";
    const expected = "<tt>const x = 1;\n</tt>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles full multiline bold blocks", () => {
    const input = "**HELLO\nTHIS IS A FULL PARAGRAPH\nIN BOLD**";
    const expected = "<b>HELLO\nTHIS IS A FULL PARAGRAPH\nIN BOLD</b>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles full multiline italic blocks", () => {
    const input = "*This is italic\nacross multiple lines.*";
    const expected = "<i>This is italic\nacross multiple lines.</i>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("preserves nested inline formatting in multiline blocks", () => {
    const input = "**Bold paragraph with `inline code` inside**";
    const expected = "<b>Bold paragraph with <tt>inline code</tt> inside</b>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("stops formatting at paragraph boundaries", () => {
    const input = "**Bold paragraph**\n\nNot bold paragraph";
    const expected = "<b>Bold paragraph</b>\n\nNot bold paragraph";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("prevents bleed on unmatched multiline formatting", () => {
    const input = "**Unclosed bold\n\nNext paragraph";
    const expected = "**Unclosed bold\n\nNext paragraph";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("escapes XML inside formatted blocks", () => {
    const input = "**Bold text with <xml> inside**";
    const expected = "<b>Bold text with &lt;xml&gt; inside</b>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles mixed formatted and unformatted sections", () => {
    const input = "Normal text\n\n**Bold block\nSecond line**\n\n*Italic*\n\nNormal again";
    const expected = "Normal text\n\n<b>Bold block\nSecond line</b>\n\n<i>Italic</i>\n\nNormal again";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles bold italic combinations", () => {
    const input = "***Bold and italic***";
    const expected = "<b><i>Bold and italic</i></b>";
    expect(markdownToPango(input)).toBe(expected);
  });

  test("handles large responses with various formatting", () => {
    const input = `# Title\n\nHere is a response with **bold text** and *italic text*.\n\n***Bold and italic***\n\n- List item 1\n- List item 2\n\n\`\`\`ts\nconst large = true;\n\`\`\``;
    const expected = `<span weight="bold" size="large">Title</span>\n\nHere is a response with <b>bold text</b> and <i>italic text</i>.\n\n<b><i>Bold and italic</i></b>\n\n  • List item 1\n  • List item 2\n\n<tt>const large = true;\n</tt>`;
    expect(markdownToPango(input)).toBe(expected);
  });
});
