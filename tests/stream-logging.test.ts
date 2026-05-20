import { describe, expect, test } from "bun:test";
import { formatPrettyLine } from "../src/ai/observability/format";
import type { AiOrchestrationEvent } from "../src/ai/observability/events";

describe("Stream Logging Format", () => {
  const now = new Date("2026-05-15T14:46:10.000Z");
  const options = { now, colorEnabled: false, mode: "pretty" as const };

  test("STREAM event shows warming state before throughput is measurable", () => {
    const event: AiOrchestrationEvent = {
      kind: "STREAM",
      severity: "info",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      requestId: "4dd20da8",
      streamState: "warming",
      tokensPerSec: 0,
      completionTokens: 0,
    };

    const line = formatPrettyLine(event, options);

    expect(line).toContain("STREAM");
    expect(line).toContain("warming up...");
    expect(line).not.toContain("0 tok/s");
  });

  test("STREAM event shows throughput when active", () => {
    const event: AiOrchestrationEvent = {
      kind: "STREAM",
      severity: "info",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      requestId: "4dd20da8",
      streamState: "active",
      tokensPerSec: 142,
      completionTokens: 53,
    };

    const line = formatPrettyLine(event, options);

    expect(line).toContain("STREAM");
    expect(line).toContain("142 tok/s avg");
    expect(line).toContain("completion=53");
    expect(line).not.toContain("0 tok/s");
  });

  test("STREAM event does not show 0 tok/s in any state", () => {
    const warmingEvent: AiOrchestrationEvent = {
      kind: "STREAM",
      severity: "info",
      providerId: "groq",
      requestId: "test",
      streamState: "warming",
      tokensPerSec: 0,
    };

    const activeEvent: AiOrchestrationEvent = {
      kind: "STREAM",
      severity: "info",
      providerId: "groq",
      requestId: "test",
      streamState: "active",
      tokensPerSec: 84,
      completionTokens: 21,
    };

    const warmingLine = formatPrettyLine(warmingEvent, options);
    const activeLine = formatPrettyLine(activeEvent, options);

    expect(warmingLine).not.toContain("0 tok/s");
    expect(activeLine).not.toContain("0 tok/s");
    expect(activeLine).toContain("84 tok/s avg");
  });

  test("OK event shows final token counts", () => {
    const event: AiOrchestrationEvent = {
      kind: "OK",
      severity: "info",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      requestId: "4dd20da8",
      durationMs: 1600,
      totalTokens: 2102,
      promptTokens: 2049,
      completionTokens: 53,
    };

    const line = formatPrettyLine(event, options);

    expect(line).toContain("OK");
    expect(line).toContain("done 1.6s");
    expect(line).toContain("total=2102");
    expect(line).toContain("prompt=2049");
    expect(line).toContain("completion=53");
  });

  test("START event shows model name", () => {
    const event: AiOrchestrationEvent = {
      kind: "START",
      severity: "info",
      providerId: "groq",
      model: "openai/gpt-oss-120b",
      requestId: "4dd20da8",
    };

    const line = formatPrettyLine(event, options);

    expect(line).toContain("START");
    expect(line).toContain("openai/gpt-oss-120b");
  });
});
