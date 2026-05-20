import { describe, test, expect } from "bun:test";
import { OpenAIProvider } from "../../../src/ai/provider/openai";
import { AuthenticationError } from "../../../src/ai/errors";
import { createStream } from "../../shared/fixtures";

describe("OpenAI Provider", () => {
  test("streams correctly and extracts content", async () => {
    const provider = new OpenAIProvider("sk-valid", async () => {
      return new Response(createStream([
        'data: {"choices":[{"delta":{"content":"OpenAI"}}]}\n\n',
        "data: [DONE]\n\n",
      ]), { status: 200 });
    });

    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "gpt-4",
      messages: [{ role: "user", content: "hello" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ content: "OpenAI" }]);
  });

  test("handles OpenAI error format", async () => {
    const provider = new OpenAIProvider("sk-invalid", async () => {
      return new Response(JSON.stringify({
        error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" }
      }), { status: 401 });
    });

    try {
      await provider.streamChat({
        model: "gpt-4",
        messages: [{ role: "user", content: "hello" }],
      }).next();
      throw new Error("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthenticationError);
      expect((e as AuthenticationError).message).toBe("Incorrect API key provided");
    }
  });
});
