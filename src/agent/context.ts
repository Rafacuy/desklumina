import { logger } from "../logger";
import { providerTokenCounter } from "../ai/middleware";
import type { AIMessage, ToolResult } from "../types";
import { SAFE_TOKEN_LIMIT } from "../constants";
import { cleanTrackTitle } from "../utils/format";

export function formatToolResults(results: ToolResult[]): string {
  return results
    .map((r) => {
      const header = `[TOOL RESULT: ${r.tool}]`;

      const formatTruncated = (str: string, maxLen: number) => {
        return str.length > maxLen ? str.slice(0, maxLen).trim() + `\n...(truncated, original length: ${str.length})` : str.trim();
      };

      const trackLines = r.extra?.tracks && r.extra.tracks.length > 0
        ? [
            "tracks:",
            ...r.extra.tracks.map((t: any) => {
              const parts: string[] = [];
              if (t.status) parts.push(t.status);
              if (t.title) parts.push(`"${cleanTrackTitle(t.title)}"`);
              if (t.artist) parts.push(`by ${t.artist}`);
              if (t.album) parts.push(`on ${t.album}`);
              if (t.elapsed && t.duration) parts.push(`[${t.elapsed}/${t.duration}]`);
              if (t.backend) parts.push(`(${t.backend})`);
              return `  - ${parts.join(" ")}`;
            }),
          ]
        : [];

      const lines = [
        `status=${r.success === false ? "failed" : "ok"}`,
        r.normalizedArg ? `args=${r.normalizedArg}` : "",
        r.extra?.activePrimaryBackend ? `active_backend=${r.extra.activePrimaryBackend}` : "",
        ...trackLines,
        r.extra?.summary?.totalMatches !== undefined ? `matches=${r.extra.summary.totalMatches}` : "",
        r.extra?.selectedFile ? `file=${r.extra.selectedFile}` : "",
        r.extra?.files && r.extra.files.length > 0 ? "files:" : "",
        ...(r.extra?.files ? r.extra.files.slice(0, 3).map((file: any) => `  - ${file.path}`) : []),
        r.extra?.files && r.extra.files.length > 3 ? `  - (...and ${r.extra.files.length - 3} more)` : "",
        r.extra?.preview?.content ? `preview=\n${formatTruncated(r.extra.preview.content, 200)}` : "",
        r.stdout ? `stdout=\n${formatTruncated(r.stdout, 500)}` : "",
        r.stderr ? `stderr=\n${formatTruncated(r.stderr, 500)}` : "",
        r.success === false && r.result ? `msg=\n${formatTruncated(r.result, 500)}` : "",
      ].filter(Boolean);

      return `${header}\n${lines.join("\n")}`;
    })
    .join("\n\n---\n\n");
}

export function trimHistory(history: AIMessage[]): AIMessage[] {
  // ensure we keep the system message and the original user query
  const system = history[0]?.role === "system" ? history[0] : null;
  const original = history[1]?.role === "user" ? history[1] : null;

  // Keep the last two full turns (assistant + user messages) as recent context
  const recent = history.slice(-4);

  let trimmed: AIMessage[];
  if (system && original) {
    trimmed = [system, original, ...recent];
  } else {
    //Fallback: retain the first message and the recent window.
    logger.warn(
      "context",
      "trimHistory: unexpected history structure, falling back to first message + last 4"
    );
    trimmed = [history[0]!, ...recent];
  }

  // Guard against token overflow even after trimming.
  // If the trimmed history is still over the SAFE_TOKEN_LIMIT, aggressively truncate
  // the newest user message content (which is most likely the large payload).
  // it ensures we never pass an over‑limit payload to the model.
  const safeTrim = (msgs: AIMessage[]): AIMessage[] => {
    while (estimateHistoryTokens(msgs) > SAFE_TOKEN_LIMIT && msgs.length > 2) {
      // Find the last user‑role message (should be the most recent user turn)
      const idx = msgs.findLastIndex((m) => m.role === "user");
      if (idx < 0) break;
      const msg = msgs[idx];
      if (!msg) break;
      //Truncate its content to half its current length
      const truncated = msg.content.slice(0, Math.floor(msg.content.length / 2));
      msgs[idx] = { role: msg.role || "user", content: truncated };
    }
    return msgs;
  };

  return safeTrim(trimmed);
}

export function estimateHistoryTokens(history: AIMessage[]): number {
  const fullText = history.map((m) => m.content).join("\n");
  return providerTokenCounter.estimateText(fullText);
}
