import { expect, test, describe } from "bun:test";
import { formatRofiResponse, isTableRow, isSeparatorRow, partitionBlocks } from "../src/utils/formatting/table-formatter";

describe("table-formatter utilities", () => {
  test("detects table rows", () => {
    expect(isTableRow("| Header 1 | Header 2 |")).toBe(true);
    expect(isTableRow("  | Space prefixed |  ")).toBe(true);
    expect(isTableRow("|---|---|")).toBe(true);
    expect(isTableRow("This is | not a table row")).toBe(false);
    expect(isTableRow("| Starts with pipe but does not end")).toBe(false);
  });

  test("detects separator rows", () => {
    expect(isSeparatorRow("|---|---|")).toBe(true);
    expect(isSeparatorRow("| :--- | :---: | ---: |")).toBe(true);
    expect(isSeparatorRow("| Planet | Radius |")).toBe(false);
    expect(isSeparatorRow("| - | - |")).toBe(true);
    expect(isSeparatorRow("| --- |---|")).toBe(true);
    expect(isSeparatorRow("|--|--|")).toBe(true);
    expect(isSeparatorRow("  | --- | --- |  ")).toBe(true);
  });

  test("partitions blocks correctly", () => {
    const markdown = "Hello World\n\n| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |\n\nSome text.";
    const blocks = partitionBlocks(markdown);
    
    expect(blocks.length).toBe(5);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("empty");
    expect(blocks[2].type).toBe("table");
    expect(blocks[3].type).toBe("empty");
    expect(blocks[4].type).toBe("text");
    
    if (blocks[2].type === "table") {
      expect(blocks[2].lines.length).toBe(3);
      expect(blocks[2].lines[0]).toBe("| Col 1 | Col 2 |");
    }
  });
});

function stripMarkup(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

describe("formatRofiResponse", () => {
  test("processes empty and non-table responses", () => {
    const emptyResult = formatRofiResponse("", 50);
    expect(emptyResult.lines).toEqual([""]);
    expect(emptyResult.hasTable).toBe(false);
    expect(emptyResult.maxTableWidth).toBe(0);

    const normalText = "This is a simple paragraph without tables.";
    const result = formatRofiResponse(normalText, 50);
    expect(result.lines).toEqual([normalText]);
    expect(result.hasTable).toBe(false);
    expect(result.maxTableWidth).toBe(0);
  });

  test("formats standard markdown table correctly", () => {
    const input = "| Plan | Status |\n|---|---|\n| Earth | Good |";
    const result = formatRofiResponse(input, 50);
    
    expect(result.hasTable).toBe(true);
    expect(result.maxTableWidth).toBe(17);

    expect(result.lines[1]).toContain("├───┼───┤");
    expect(result.lines[0]).toContain('<span face="monospace">');
    expect(result.lines[0]).toContain('Plan');
    expect(result.lines[0]).toContain('Status');
    expect(result.lines[2]).toContain('Earth');
    expect(result.lines[2]).toContain('Good');
  });

  test("handles multiple tables and mixed paragraphs", () => {
    const input = "Intro text.\n\n| T1 |\n|---|\n| A |\n\nMiddle text.\n\n| T2 |\n|---|\n| B |\n\nOutro text.";
    const result = formatRofiResponse(input, 50);
    
    expect(result.hasTable).toBe(true);
    expect(result.lines.length).toBe(13);
    expect(result.lines[0]).toBe("Intro text.");
    expect(result.lines[1]).toBe("");
    expect(result.lines[2]).toContain("T1");
    expect(result.lines[6]).toBe("Middle text.");
    expect(result.lines[8]).toContain("T2");
    expect(result.lines[12]).toBe("Outro text.");
  });

  test("preserves inline markdown inside table cells", () => {
    const input = "| Planet | Note |\n|---|---|\n| **Earth** | *Life* and `code` |";
    const result = formatRofiResponse(input, 50);
    
    expect(result.lines[2]).toContain("<b>Earth</b>");
    expect(result.lines[2]).toContain("<i>Life</i>");
    expect(result.lines[2]).toContain("<tt>code</tt>");
  });

  test("escapes markup inside cells correctly", () => {
    const input = "| Unsafe |\n|---|\n| <script> & high |";
    const result = formatRofiResponse(input, 50);
    
    expect(result.lines[2]).toContain("&lt;script&gt;");
    expect(result.lines[2]).toContain("&amp;");
    expect(result.lines[2]).toContain('<span foreground="#94a3b8">│</span>');
  });

  test("handles escaped pipe character \\| inside cells", () => {
    const input = "| Col 1 | Col 2 |\n|---|---|\n| Escaped \\| Pipe | Literal |";
    const result = formatRofiResponse(input, 50);
    
    expect(result.lines[2]).toContain("Escaped");
    expect(result.lines[2]).toContain("|");
    expect(result.lines[2]).toContain("Pipe");
    expect(result.lines[2]).toContain("Literal");
    expect(result.lines[2]).not.toContain("\\|");
  });

  test("handles unicode characters", () => {
    const input = "| 惑星 | 人口 |\n|---|---|\n| 地球 🌍 | 80億 |";
    const result = formatRofiResponse(input, 50);
    
    expect(result.hasTable).toBe(true);
    expect(result.lines[2]).toContain("地球");
    expect(result.lines[2]).toContain("🌍");
    expect(result.lines[2]).toContain("80億");
  });

  test("does not wrap wide table lines but wraps paragraphs", () => {
    const veryLongWord = "A".repeat(80);
    const input = `This is a long description that should wrap naturally because it is a normal text paragraph.\n\n| Col 1 | ${veryLongWord} |`;
    
    const result = formatRofiResponse(input, 50);
    
    const paraLines = result.lines.filter(l => !l.includes("face="));
    expect(paraLines.length).toBeGreaterThan(1);
    
    const tableLines = result.lines.filter(l => l.includes("face="));
    expect(tableLines.length).toBe(1);
    expect(tableLines[0]).toContain(veryLongWord);
  });

  test("handles multiline paragraphs and large AI responses", () => {
    const input = "Line 1\nLine 2\nLine 3\n\n| Header |\n|---|\n| Data |\n\nLine 4\nLine 5";
    const result = formatRofiResponse(input, 50);
    
    expect(result.lines.length).toBe(10);
    expect(result.lines[0]).toBe("Line 1");
    expect(result.lines[1]).toBe("Line 2");
    expect(result.lines[2]).toBe("Line 3");
    expect(result.lines[3]).toBe("");
    expect(result.lines[4]).toContain("Header");
    expect(result.lines[8]).toBe("Line 4");
    expect(result.lines[9]).toBe("Line 5");
  });

  test("handles malformed table rows safely", () => {
    const input = "| Header |\n|---|";
    const result = formatRofiResponse(input, 50);
    
    expect(result.hasTable).toBe(true);
    expect(result.lines[0]).toContain("Header");
    expect(result.lines[1]).toContain("├───┤");
  });

  test("wraps long paragraphs correctly", () => {
    const longPara = "Apple Banana Cherry Date Elderberry Fig Grape Honeydew Apple Banana Cherry Date Elderberry Fig Grape Honeydew";
    const result = formatRofiResponse(longPara, 30);
    expect(result.hasTable).toBe(false);
    expect(result.lines.length).toBeGreaterThan(1);
    for (const line of result.lines) {
      const plain = line.replace(/<[^>]+>/g, "");
      expect(Array.from(plain).length).toBeLessThanOrEqual(33);
    }
  });

  test("uses non-breaking spaces in data rows to prevent Pango wrapping", () => {
    const input = "| A | B |\n|---|---|\n| X | Y |";
    const result = formatRofiResponse(input, 50);
    let dataCount = 0;
    for (const line of result.lines) {
      if (line.includes('face="monospace"') && !line.includes("│──")) {
        dataCount++;
        expect(line).not.toContain("wrap_mode");
        expect(line.match(/\u00A0/g) || []).length;
      }
    }
    expect(dataCount).toBeGreaterThan(0);
  });

  test("handles responses without any tables", () => {
    const text = "Just a plain response with no tables at all. Everything should flow as normal text with wrapping.";
    const result = formatRofiResponse(text, 120);
    expect(result.hasTable).toBe(false);
    expect(result.maxTableWidth).toBe(0);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0]).toBe(text);
  });

  test("handles large responses with mixed tables and paragraphs", () => {
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      lines.push(`| Col${i}A | Col${i}B |\n|---|---|\n| Data${i}A | Data${i}B |`);
    }
    const input = lines.join("\n\n");
    const result = formatRofiResponse(input, 50);
    expect(result.hasTable).toBe(true);
    expect(result.lines.length).toBeGreaterThanOrEqual(3);
  });

  test("does not emit unescaped HTML in rendered output", () => {
    const input = "| <bad> |\n|---|\n| <script>alert(1)</script> |";
    const result = formatRofiResponse(input, 50);
    expect(result.lines.length).toBe(3);
    for (const line of result.lines) {
      expect(line).not.toContain("<bad>");
      expect(line).not.toContain("<script>");
    }
    expect(result.lines[0]).toContain("&lt;bad&gt;");
    expect(result.lines[2]).toContain("&lt;script&gt;");
    expect(result.lines[2]).toContain("alert(1)");
  });

  test("formatted output does not contain raw markdown pipe syntax", () => {
    const input = "| H1 | H2 |\n|---|---|\n| D1 | D2 |";
    const result = formatRofiResponse(input, 50);
    for (const line of result.lines) {
      const plain = stripMarkup(line);
      expect(plain).not.toMatch(/^\|.*\|$/);
    }
  });
});
