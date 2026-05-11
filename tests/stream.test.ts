import { describe, test, expect, spyOn } from "bun:test";
import { parseSSE } from "../src/ai/stream";
import { logger } from "../src/logger";

describe("SSE Stream Parsing", () => {
  function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      }
    });
  }

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
      results.push(chunk.content);
    }

    expect(results).toEqual(["Hello", " World"]);
  });

  test("should correctly parse usage data from SSE", async () => {
    const stream = createMockStream([
      'data: {"choices": [{"delta": {"content": "Final chunk"}}], "usage": null}\n\n',
      'data: {"choices": [], "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}\n\n'
    ]);

    const generator = parseSSE(stream);
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toContainEqual({ content: "Final chunk" });
    expect(results).toContainEqual({
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    });
  });
});
