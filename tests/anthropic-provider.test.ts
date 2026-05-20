import { describe, test, expect } from "bun:test";
import { AnthropicProvider } from "../src/ai/provider/anthropic";
import { ProviderAPIError } from "../src/ai/errors";
import { createStream } from "./shared/fixtures";

describe("Anthropic Provider", () => {
  test("streams correctly and extracts content and usage", async () => {
    const provider = new AnthropicProvider("ant-valid", async () => {
      return new Response(createStream([
        'event: message_start\n',
        'data: {"type": "message_start", "message": {"id": "msg_1", "usage": {"input_tokens": 10, "output_tokens": 1}}}\n\n',
        'event: content_block_start\n',
        'data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}\n\n',
        'event: content_block_delta\n',
        'data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Claude"}}\n\n',
        'event: message_delta\n',
        'data: {"type": "message_delta", "usage": {"output_tokens": 5}}\n\n',
        'event: message_stop\n',
        'data: {"type": "message_stop"}\n\n',
      ]), { status: 200 });
    });

    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "claude-3-sonnet",
      messages: [{ role: "user", content: "hello" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: "Claude" },
      { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } }
    ]);
  });

  test("handles Anthropic stream error", async () => {
    const provider = new AnthropicProvider("ant-valid", async () => {
      return new Response(createStream([
        'event: error\n',
        'data: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}\n\n',
      ]), { status: 200 });
    });

    try {
      await provider.streamChat({
        model: "claude-3",
        messages: [{ role: "user", content: "hello" }],
      }).next();
      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderAPIError);
      expect((e as ProviderAPIError).message).toBe("Overloaded");
    }
  });

  test("correctly maps system messages to the system parameter", async () => {
    let capturedBody: any;
    const provider = new AnthropicProvider("ant-valid", async (url, options) => {
      capturedBody = JSON.parse(options?.body as string);
      return new Response(createStream([
        'event: message_stop\n',
        'data: {"type": "message_stop"}\n\n',
      ]), { status: 200 });
    });

    await provider.streamChat({
      model: "claude-3",
      messages: [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Hello" }
      ],
    }).next();

    expect(capturedBody.system).toBe("You are a helpful assistant");
    expect(capturedBody.messages).toHaveLength(1);
    expect(capturedBody.messages[0].role).toBe("user");
  });
});
