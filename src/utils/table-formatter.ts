import { markdownToPango, wrapPangoText } from "./pango";

const tableRowRegex = /^\s*\|(.*)\|\s*$/;
const separatorRegex = /^\s*\|(?:\s*:?-+:?\s*\|\s*)+\s*$/;

export function isTableRow(line: string): boolean {
  return tableRowRegex.test(line);
}

export function isSeparatorRow(line: string): boolean {
  return separatorRegex.test(line);
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

    const isTable = tableRowRegex.test(line);
    if (isTable) {
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
  maxTableWidth: number;
}

export function replaceSpacesOutsideTags(text: string): string {
  return text.replace(/<[^>]*>| /g, (match) => {
    if (match.startsWith("<")) return match;
    return "\u00A0";
  });
}

export function formatRofiResponse(text: string, wrapWidth: number): FormattedResponse {
  const blocks = partitionBlocks(text);
  const resultLines: string[] = [];
  let hasTable = false;
  let maxTableWidth = 0;

  for (const block of blocks) {
    if (block.type === "table") {
      hasTable = true;
      for (const line of block.lines) {
        const rawWidth = line.replace(/\\\|/g, "|").trim().length;
        if (rawWidth > maxTableWidth) {
          maxTableWidth = rawWidth;
        }

        if (separatorRegex.test(line)) {
          const trimmed = line.trim();
          const parts = trimmed.split("|");
          const innerParts = parts.slice(1, -1);
          const formattedInner = innerParts.map(part => "─".repeat(part.trim().length)).join("┼");
          const separatorLine = `├${formattedInner}┤`;
          resultLines.push(`<span face="monospace" foreground="#94a3b8">${separatorLine}</span>`);
        } else {
          const trimmed = line.trim();
          const shielded = trimmed.replace(/\\\|/g, "\u0000");
          const parts = shielded.split("|");
          const innerParts = parts.slice(1, -1);
          const formattedInner = innerParts.map(part => {
            const restored = part.replace(/\u0000/g, "|");
            return markdownToPango(restored);
          }).join('<span foreground="#94a3b8">│</span>');
          const row = `<span face="monospace"><span foreground="#94a3b8">│</span>${formattedInner}<span foreground="#94a3b8">│</span></span>`;
          resultLines.push(replaceSpacesOutsideTags(row));
        }
      }
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
