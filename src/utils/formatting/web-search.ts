import type { ToolExtraData, WebSearchExtraData } from "../../types";

const CONTEXT_BUDGET = 3000; //keep it simple -- dont blow up the context window

// dumb down the web search extra into a string we can shove into the prompt
export function formatWebSearchContext(extra: ToolExtraData | undefined): string {
  const ws = (extra as { webSearch?: WebSearchExtraData } | undefined)?.webSearch;
  if (!ws) return "";
  const lines: string[] = [];
  lines.push(`web_search: ${ws.provider}`);
  lines.push(`query="${ws.query}"`);
  lines.push(`results=${ws.returnedCount}/${ws.requestedLimit}`);
  if (ws.warnings.length > 0) lines.push(`warnings=${ws.warnings.join("; ")}`);
  let remaining = CONTEXT_BUDGET;
  for (const line of lines) remaining -= line.length + 1;
  for (const result of ws.results) {
    const resultLine = `${result.rank}. ${result.title} — ${result.url}`;
    if (remaining < resultLine.length + 1) break; //budget ran out, stop
    lines.push(resultLine);
    remaining -= resultLine.length + 1;
  }
  return lines.join("\n");
}
