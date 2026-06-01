import { describe, test, expect } from "bun:test";
import { parseSSEEvents } from "../../../src/ai/stream/sse-parser";
import { OpenAICompatibleAdapter } from "../../../src/ai/transport/openai-compatible";
import { GroqProvider } from "../../../src/ai/providers/groq";
import { AuthenticationError, ProviderAPIError, RateLimitError } from "../../../src/ai/errors";
import { validateProviderRuntimeConfig } from "../../../src/ai/config/runtime";
import { createStream } from "../../shared/fixtures";

describe("AI provider foundations", () => {
  test("parses SSE events across chunk boundaries", async () => {
    const stream = createStream([
      'data: {"choices":[{"delta":{"content":"Hel',
      'lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const events: string[] = [];
    for await (const event of parseSSEEvents(stream, { provider: "test" })) {
      events.push(event.data);
    }

    expect(events).toEqual([
      '{"choices":[{"delta":{"content":"Hello"}}]}',
      "[DONE]",
    ]);
  });

  test("normalizes OpenAI-compatible stream chunks", async () => {
    const provider = new GroqProvider("gsk_valid_key_1234567890123456789012345678901234567890", async () => {
      return new Response(createStream([
        'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}\n\n',
        "data: [DONE]\n\n",
      ]), { status: 200 });
    });

    const chunks = [];
    for await (const chunk of provider.streamChat({
      model: "groq:llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "hello" }],
      streamUsage: true,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { content: "Hi" },
      { usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 } },
    ]);
  });

  test("normalizes authentication, rate limit, and API errors", async () => {
    const authProvider = new OpenAICompatibleAdapter({
      provider: "test",
      name: "Test",
      baseUrl: "https://example.invalid/chat",
      apiKey: "key",
      fetchImpl: async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 }),
    });

    await expect(authProvider.streamChat({
      model: "test-model",
      messages: [{ role: "user", content: "hello" }],
    }).next()).rejects.toBeInstanceOf(AuthenticationError);

    const rateProvider = new OpenAICompatibleAdapter({
      provider: "test",
      name: "Test",
      baseUrl: "https://example.invalid/chat",
      apiKey: "key",
      fetchImpl: async () => new Response("rate limited", { status: 429 }),
    });

    await expect(rateProvider.streamChat({
      model: "test-model",
      messages: [{ role: "user", content: "hello" }],
    }).next()).rejects.toBeInstanceOf(RateLimitError);

    const apiProvider = new OpenAICompatibleAdapter({
      provider: "test",
      name: "Test",
      baseUrl: "https://example.invalid/chat",
      apiKey: "key",
      fetchImpl: async () => new Response("server failed", { status: 503 }),
    });

    await expect(apiProvider.streamChat({
      model: "test-model",
      messages: [{ role: "user", content: "hello" }],
    }).next()).rejects.toMatchObject({
      name: "ProviderAPIError",
      statusCode: 503,
      retryable: true,
    } satisfies Partial<ProviderAPIError>);
  });

  test("validates provider runtime config with clear failures", () => {
    expect(() => validateProviderRuntimeConfig({
      groqApiKey: "",
      openaiApiKey: "",
      anthropicApiKey: "",
      primaryModel: "",
      fallbackModels: [],
    })).toThrow(/At least one provider API key/);
  });
});

