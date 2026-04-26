import { describe, test, expect, spyOn } from "bun:test";
import { parseSSE } from "../src/ai/stream";
import { logger } from "../src/logger";

describe("SSE Stream Parsing", () => {
  test("should log warning when JSON parsing fails", async () => {
    const warnSpy = spyOn(logger, "warn");
    
    // Create a stream with malformed JSON
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: { invalid json\n\n"));
        controller.close();
      }
    });

    const generator = parseSSE(stream);
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    const lastCall = warnSpy.mock.calls[warnSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe("stream");
    expect(lastCall[1]).toContain("Failed to parse SSE chunk");
    
    warnSpy.mockRestore();
  });

  test("should correctly parse valid SSE data", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    const generator = parseSSE(stream);
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(["Hello", " World"]);
  });
});
