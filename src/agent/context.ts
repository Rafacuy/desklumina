import { logger } from "../logger";
import { providerTokenCounter } from "../ai/middleware";
import type { AIMessage, ToolResult, CompletedOperation, PendingOperation } from "../types";
import { SAFE_TOKEN_LIMIT } from "../constants";
import { cleanTrackTitle } from "../utils/formatting/format";
import { formatWebSearchContext } from "../utils/formatting/web-search";

export { formatWebSearchContext };

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
        r.extra?.summary?.provider ? `provider=${r.extra.summary.provider}` : "",
        r.extra?.summary?.warnings && r.extra.summary.warnings.length > 0
          ? `warnings=${r.extra.summary.warnings.join("; ")}`
          : "",
        r.extra?.selectedFile ? `file=${r.extra.selectedFile}` : "",
        r.extra?.files && r.extra.files.length > 0 ? "files:" : "",
        ...(r.extra?.files ? r.extra.files.slice(0, 3).map((file: any) => `  - ${file.path}`) : []),
        r.extra?.files && r.extra.files.length > 3 ? `  - (...and ${r.extra.files.length - 3} more)` : "",
        r.extra?.preview?.content ? `preview=\n${formatTruncated(r.extra.preview.content, 200)}` : "",
        formatWebSearchContext(r.extra),
        r.stdout ? `stdout=\n${formatTruncated(r.stdout, 500)}` : "",
        r.stderr ? `stderr=\n${formatTruncated(r.stderr, 500)}` : "",
        r.success === false && r.result ? `msg=\n${formatTruncated(r.result, 500)}` : "",
      ].filter(Boolean);

      return `${header}\n${lines.join("\n")}`;
    })
    .join("\n\n---\n\n");
}

export function trimHistory(history: AIMessage[]): AIMessage[] {
  const system = history[0]?.role === "system" ? history[0] : null;
  const original = history[1]?.role === "user" ? history[1] : null;
  const recent = history.slice(-4);

  let trimmed: AIMessage[];
  if (system && original) {
    trimmed = [system, original, ...recent];
  } else {
    logger.warn(
      "context",
      "trimHistory: unexpected history structure, falling back to first message + last 4"
    );
    trimmed = [history[0]!, ...recent];
  }

  // If still over limit, halve the newest user message (usually the large payload)
  const safeTrim = (msgs: AIMessage[]): AIMessage[] => {
    while (estimateHistoryTokens(msgs) > SAFE_TOKEN_LIMIT && msgs.length > 2) {
      const idx = msgs.findLastIndex((m) => m.role === "user");
      if (idx < 0) break;
      const msg = msgs[idx];
      if (!msg) break;
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

export function formatBackgroundResults(ops: CompletedOperation[]): string {
  const lines: string[] = [
    "[BACKGROUND OPERATIONS COMPLETED]",
    "",
    "The following operations completed since your last response:",
    "",
  ];

  for (const op of ops) {
    if (op.status === "failure") {
      const stderr = op.result.stderr ? `, stderr: ${op.result.stderr.slice(0, 200)}` : "";
      const exitCode = op.result.exitCode !== undefined ? `exit code ${op.result.exitCode}` : "unknown error";
      lines.push(`- ${op.tool} "${op.arg}": FAILED — ${exitCode}${stderr}`);
    } else {
      const resultText = op.result.result ? op.result.result.slice(0, 200) : "OK";
      lines.push(`- ${op.tool} "${op.arg}": OK — ${resultText}`);
    }
  }

  return lines.join("\n");
}

export function formatPendingOperations(ops: PendingOperation[]): string {
  const lines: string[] = [
    "[BACKGROUND OPERATIONS]",
    "",
    "Pending (still running):",
  ];

  for (const op of ops) {
    const elapsed = Math.round((Date.now() - op.startedAt) / 1000);
    lines.push(`- ${op.tool}: "${op.arg}" (started ${elapsed}s ago)`);
  }

  return lines.join("\n");
}
