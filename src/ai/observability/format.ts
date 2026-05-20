import type { AiOrchestrationEvent } from "./events";
import { severityStyle } from "./ansi";
import { formatProviderColumn } from "./theme";
import { padRight, truncateEnd } from "./text";

export interface FormatOrchestrationOptions {
  readonly now: Date;
  readonly colorEnabled: boolean;
  readonly mode: "pretty" | "json";
}

function formatLocalTime(d: Date): string {
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function severityLabel(sev: AiOrchestrationEvent["severity"]): string {
  return sev.toUpperCase();
}

function buildTail(event: AiOrchestrationEvent): string {
  const parts: string[] = [];
  switch (event.kind) {
    case "START":
      if (event.model) parts.push(truncateEnd(event.model, 56));
      break;
    case "STREAM": {
      if (event.streamState === "warming") {
        parts.push("warming up...");
      } else if (event.tokensPerSec !== undefined && event.tokensPerSec > 0) {
        parts.push(`${event.tokensPerSec} tok/s avg`);
      }
      if (event.completionTokens !== undefined && event.completionTokens > 0) {
        parts.push(`completion=${event.completionTokens}`);
      }
      break;
    }
    case "OK": {
      if (event.durationMs !== undefined) parts.push(`done ${(event.durationMs / 1000).toFixed(1)}s`);
      if (event.totalTokens !== undefined) parts.push(`total=${event.totalTokens}`);
      if (event.promptTokens !== undefined) parts.push(`prompt=${event.promptTokens}`);
      if (event.completionTokens !== undefined) parts.push(`completion=${event.completionTokens}`);
      break;
    }
    case "RETRY":
      if (event.fromModel && event.toModel) {
        parts.push(`${truncateEnd(event.fromModel, 28)} -> ${truncateEnd(event.toModel, 28)}`);
      } else if (event.fromModel) {
        parts.push(truncateEnd(event.fromModel, 48));
      } else if (event.detail) {
        parts.push(truncateEnd(event.detail, 64));
      }
      break;
    case "RATE_LIMITED":
    case "ERROR": {
      if (event.httpStatus !== undefined) parts.push(`HTTP ${event.httpStatus}`);
      if (event.retryable !== undefined) parts.push(`retryable=${event.retryable ? "yes" : "no"}`);
      const msg = event.detail ?? "";
      if (msg) parts.push(truncateEnd(msg, 72));
      break;
    }
    case "ABORT":
      parts.push(event.detail ? truncateEnd(event.detail, 48) : "signal");
      break;
    case "DEBUG":
      parts.push(truncateEnd(event.detail ?? event.legacyMessage ?? "", 80));
      break;
    default:
      parts.push(truncateEnd(event.detail ?? "", 64));
  }
  if (event.requestId) parts.push(`req=${truncateEnd(event.requestId, 12)}`);
  return parts.join("  ");
}

export function formatPrettyLine(event: AiOrchestrationEvent, options: FormatOrchestrationOptions): string {
  const color = options.colorEnabled;
  const time = formatLocalTime(options.now);
  const sevRaw = padRight(severityLabel(event.severity), 5);
  const sev = severityStyle(event.severity, sevRaw, color);
  const prov = formatProviderColumn(event.providerId, color);
  const kind = padRight(event.kind, 12);
  const tail = buildTail(event);
  return `${time} ${sev} ${prov} ${kind}${tail ? ` ${tail}` : ""}`;
}

export function formatFileNdjson(
  event: AiOrchestrationEvent,
  options: FormatOrchestrationOptions,
  sanitize: (v: unknown) => unknown
): string {
  const record = sanitize({
    ts: options.now.toISOString(),
    module: "ai-orchestration",
    kind: event.kind,
    severity: event.severity,
    providerId: event.providerId,
    requestId: event.requestId,
    model: event.model,
    detail: event.detail,
    httpStatus: event.httpStatus,
    retryable: event.retryable,
    durationMs: event.durationMs,
    tokensPerSec: event.tokensPerSec,
    streamState: event.streamState,
    elapsedMs: event.elapsedMs,
    chunkCount: event.chunkCount,
    outputChars: event.outputChars,
    promptTokens: event.promptTokens,
    completionTokens: event.completionTokens,
    totalTokens: event.totalTokens,
    fromModel: event.fromModel,
    toModel: event.toModel,
    legacyMessage: event.legacyMessage,
  }) as Record<string, unknown>;
  return JSON.stringify(record);
}

export function formatOrchestrationEvent(
  event: AiOrchestrationEvent,
  options: FormatOrchestrationOptions,
  sanitize: (v: unknown) => unknown
): { console: string; file: string } {
  const file = formatFileNdjson(event, options, sanitize);
  if (options.mode === "json") {
    return { console: file, file };
  }
  return { console: formatPrettyLine(event, options), file };
}
