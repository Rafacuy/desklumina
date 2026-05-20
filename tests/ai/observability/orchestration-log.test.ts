import { describe, test, expect, afterEach } from "bun:test";
import { formatOrchestrationEvent, formatPrettyLine } from "../../../src/ai/observability/format";
import { sanitizeOrchestrationValue } from "../../../src/ai/observability/sanitize";
import type { AiOrchestrationEvent } from "../../../src/ai/observability/events";
import { RateLimitError } from "../../../src/ai/errors";
import { orchestrationErrorFromUnknown } from "../../../src/ai/observability/error-map";

const fixedNow = new Date("2026-05-15T12:41:22.000Z");

function opts(colorEnabled: boolean, mode: "pretty" | "json" = "pretty") {
  return { now: fixedNow, colorEnabled, mode } as const;
}

const ansiRe = /\x1b\[[0-9;]*m/g;

describe("AI orchestration logging", () => {
  afterEach(() => {
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  test("pretty line layout without ANSI", () => {
    const event: AiOrchestrationEvent = {
      kind: "START",
      severity: "info",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      requestId: "abc-123-def",
    };
    const line = formatPrettyLine(event, opts(false));
    expect(line).toMatch(/^\d{2}:\d{2}:\d{2} INFO  GROQ/);
    expect(line).toContain("START");
    expect(line).toContain("openai/gpt-oss-120b");
    expect(line).not.toMatch(ansiRe);
  });

  test("pretty line may include ANSI when color enabled", () => {
    const event: AiOrchestrationEvent = {
      kind: "START",
      severity: "info",
      providerId: "groq",
      model: "m",
    };
    const line = formatPrettyLine(event, opts(true));
    expect(line).toMatch(ansiRe);
  });

  test("NO_COLOR semantics via colorEnabledForStream false", () => {
    const event: AiOrchestrationEvent = {
      kind: "STREAM",
      severity: "info",
      providerId: "openai",
      tokensPerSec: 142,
      elapsedMs: 800,
      chunkCount: 24,
    };
    const line = formatPrettyLine(event, opts(false));
    expect(line).toContain("142 tok/s");
    expect(line).toContain("STREAM");
    expect(line).not.toMatch(ansiRe);
  });

  test("file NDJSON is valid JSON and redacts bearer-like strings in sanitize", () => {
    const event: AiOrchestrationEvent = {
      kind: "DEBUG",
      severity: "warn",
      providerId: "groq",
      detail: 'Bearer gsk_abcdefghijklmnopqrstuvwxyz1234567890',
    };
    const { file } = formatOrchestrationEvent(event, opts(false), sanitizeOrchestrationValue);
    const parsed = JSON.parse(file) as { detail?: string };
    expect(parsed.detail).toContain("[REDACTED]");
    expect(parsed.detail).not.toContain("gsk_");
  });

  test("json mode uses NDJSON for console", () => {
    const event: AiOrchestrationEvent = {
      kind: "OK",
      severity: "info",
      providerId: "groq",
      durationMs: 1800,
      totalTokens: 842,
    };
    const { console: c, file: f } = formatOrchestrationEvent(event, opts(false, "json"), sanitizeOrchestrationValue);
    expect(c).toBe(f);
    expect(JSON.parse(c).kind).toBe("OK");
  });

  test("orchestrationErrorFromUnknown maps rate limit", () => {
    const err = new RateLimitError({ provider: "groq", message: "slow down" });
    const ev = orchestrationErrorFromUnknown(err, { providerId: "groq", requestId: "rid" });
    expect(ev.kind).toBe("RATE_LIMITED");
    expect(ev.retryable).toBe(true);
    const { console: line } = formatOrchestrationEvent(ev, opts(false), sanitizeOrchestrationValue);
    expect(line).toContain("RATE_LIMITED");
  });

  test("truncate long model names in RETRY tail", () => {
    const long = "a".repeat(40);
    const event: AiOrchestrationEvent = {
      kind: "RETRY",
      severity: "warn",
      providerId: "groq",
      fromModel: long,
      toModel: `${long}b`,
    };
    const line = formatPrettyLine(event, opts(false));
    expect(line.length).toBeLessThan(200);
    expect(line).toContain("...");
  });
});
