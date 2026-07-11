import { markdownToPango, wrapPangoText } from "./pango";
import { visibleWidth, padVisibleWidth } from "./text-width";

const SEPARATOR_COLUMN_PATTERN = /^:?-+:?$/; // runs on one split segment, so no regex backtracking nonsense.

/**
 * Max cell width before we wrap inside the row.
 * Keeps one cursed paragraph-in-a-table from blowing the whole rofi window wide.
 */
export const DEFAULT_MAX_CELL_WIDTH = 40;

// Font applied to whole table rows. Iosevka maps Latin, CJK and box-drawing
// to a single monospace grid on this box; Pango's fallback otherwise mixes
// JetBrainsMono Latin with Noto CJK/IPAGothic and the columns drift apart.
export const TABLE_FONT_FAMILY = "Iosevka,monospace";

// Measured advance per monospace cell for TABLE_FONT_FAMILY 10pt at default
// screen DPI. Adjust here if your DPI or font size differs.
export const TABLE_MONO_ADVANCE_PX = 9;

const BORDER_COLOR = "#94a3b8";

export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length >= 2 && trimmed.startsWith("|") && trimmed.endsWith("|");
}

/**
 * Separator rows look simple, but the old whole-line regex could backtrack hard.
 * Split first, then validate tiny pieces. Boring, linear, good enough.
 */
export function isSeparatorRow(line: string): boolean {
  if (!isTableRow(line)) return false;
  const trimmed = line.trim();
  const parts = trimmed.split("|");
  const segments = parts.slice(1, -1);
  if (segments.length === 0) return false;
  for (const seg of segments) {
    if (!SEPARATOR_COLUMN_PATTERN.test(seg.trim())) return false;
  }
  return true;
}

/** Split cells while letting escaped pipes survive. */
function parseRowCells(line: string): string[] {
  const trimmed = line.trim();
  const shielded = trimmed.replace(/\\\|/g, "\u0000");
  const parts = shielded.split("|");
  const inner = parts.slice(1, -1);
  return inner.map((p) => p.replace(/\u0000/g, "|").trim());
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface TableBlock {
  type: "table";
  lines: string[];
}

export interface EmptyBlock {
  type: "empty";
}

export type Block = TextBlock | TableBlock | EmptyBlock;

export function partitionBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];
  let currentBlock: Block | null = null;

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      blocks.push({ type: "empty" });
      continue;
    }

    if (isTableRow(line)) {
      if (currentBlock && currentBlock.type === "table") {
        currentBlock.lines.push(line);
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: "table", lines: [line] };
      }
    } else {
      if (currentBlock && currentBlock.type === "text") {
        currentBlock.content += "\n" + line;
      } else {
        if (currentBlock) {
          blocks.push(currentBlock);
        }
        currentBlock = { type: "text", content: line };
      }
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

export interface FormattedResponse {
  lines: string[];
  hasTable: boolean;
  /** Widest rendered table row, borders included, measured in monospace cells. */
  maxTableWidth: number;
}

/** Still used by old callers that pass prebuilt Pango rows. */
export function replaceSpacesOutsideTags(text: string): string {
  return text.replace(/<[^>]*>| /g, (match) => (match.startsWith("<") ? match : "\u00A0"));
}

function renderTableBlock(
  block: TableBlock,
  maxCellWidth: number
): { lines: string[]; visualWidth: number } {
  type ParsedRow = { kind: "separator" } | { kind: "data"; cells: string[] };

  const parsedRows: ParsedRow[] = block.lines.map((line) =>
    isSeparatorRow(line) ? { kind: "separator" } : { kind: "data", cells: parseRowCells(line) }
  );

  const dataRows = parsedRows.filter((r): r is { kind: "data"; cells: string[] } => r.kind === "data");
  const columnCount = dataRows.reduce((max, r) => Math.max(max, r.cells.length), 0);

  if (columnCount === 0) {
    // Weird table-ish block with no columns. Just render it as text and move on.
    return { lines: block.lines.map((l) => markdownToPango(l)), visualWidth: 0 };
  }

  // First pass: measure rendered cells after markdown/Pango tags are stripped.
  const naturalColWidth = new Array<number>(columnCount).fill(0);
  const pangoCellCache = new Map<string, string>();
  const toPango = (raw: string): string => {
    let cached = pangoCellCache.get(raw);
    if (cached === undefined) {
      cached = markdownToPango(raw);
      pangoCellCache.set(raw, cached);
    }
    return cached;
  };

  for (const row of dataRows) {
    row.cells.forEach((raw, c) => {
      const w = visibleWidth(toPango(raw));
      if (w > naturalColWidth[c]!) naturalColWidth[c] = w;
    });
  }

  const targetColWidth = naturalColWidth.map((w) => Math.min(w, maxCellWidth));

  const resultLines: string[] = [];

  for (const row of parsedRows) {
    if (row.kind === "separator") {
      const segments = targetColWidth.map((w) => "─".repeat(w + 2)); // +2 for the padding spaces around data cells
      resultLines.push(
        `<span face="${TABLE_FONT_FAMILY}" foreground="${BORDER_COLOR}">├${segments.join("┼")}┤</span>`
      );
      continue;
    }

    const cellsWrapped = targetColWidth.map((colWidth, c) => {
      const raw = row.cells[c] ?? "";
      const pangoCell = toPango(raw);
      if (colWidth <= 0) return [""];
      return wrapPangoText(pangoCell, colWidth);
    });

    const subLineCount = Math.max(1, ...cellsWrapped.map((w) => w.length));

    for (let s = 0; s < subLineCount; s++) {
      const paddedCells = cellsWrapped.map((wrapped, c) => {
        const content = wrapped[s] ?? "";
        return padVisibleWidth(content, targetColWidth[c]!);
      });
      const inner = paddedCells.map((c) => ` ${c} `).join(`<span foreground="${BORDER_COLOR}">│</span>`);
      resultLines.push(
        `<span face="${TABLE_FONT_FAMILY}"><span foreground="${BORDER_COLOR}">│</span>${inner}<span foreground="${BORDER_COLOR}">│</span></span>`
      );
    }
  }

  const visualWidth = columnCount + 1 + targetColWidth.reduce((sum, w) => sum + w + 2, 0);
  return { lines: resultLines, visualWidth };
}

export function formatRofiResponse(
  text: string,
  wrapWidth: number,
  maxCellWidth: number = DEFAULT_MAX_CELL_WIDTH
): FormattedResponse {
  const blocks = partitionBlocks(text);
  const resultLines: string[] = [];
  let hasTable = false;
  let maxTableWidth = 0;

  for (const block of blocks) {
    if (block.type === "table") {
      hasTable = true;
      const { lines, visualWidth } = renderTableBlock(block, maxCellWidth);
      resultLines.push(...lines);
      if (visualWidth > maxTableWidth) maxTableWidth = visualWidth;
    } else if (block.type === "empty") {
      resultLines.push("");
    } else {
      const pangoText = markdownToPango(block.content);
      const wrapped = wrapPangoText(pangoText, wrapWidth);
      resultLines.push(...wrapped);
    }
  }

  return {
    lines: resultLines,
    hasTable,
    maxTableWidth,
  };
}
