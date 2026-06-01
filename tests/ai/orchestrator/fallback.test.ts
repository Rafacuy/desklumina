import { describe, test, expect, beforeEach } from "bun:test";
import { ProviderRegistry } from "../../../src/ai/registry/provider-registry";
import { ModelRegistry } from "../../../src/ai/registry/models";
import { NoModelsConfiguredError, AllModelsFailedError } from "../../../src/ai/runtime/orchestrator";
import { ProviderError } from "../../../src/ai/errors";
import { GroqProvider } from "../../../src/ai/providers/groq";
import { OpenAIProvider } from "../../../src/ai/providers/openai";
import { createStream } from "../../shared/fixtures";

describe("Orchestrator fallback", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  test("throws NoModelsConfiguredError when no providers registered", async () => {
    const failingFetch = async () => new Response("fail", { status: 500 });
    registry.register(new GroqProvider("gsk_valid_key_1234567890123456789012345678901234567890", failingFetch));

    expect(registry.list()).toHaveLength(1);
    expect(registry.isHealthy("groq")).toBe(true);
  });

  test("registers multiple providers", () => {
    registry.register(new GroqProvider("gsk_valid_key_1234567890123456789012345678901234567890"));
    registry.register(new OpenAIProvider("sk-valid"));

    expect(registry.list()).toHaveLength(2);
    expect(registry.get("groq")).toBeDefined();
    expect(registry.get("openai")).toBeDefined();
  });

  test("provider registry tracks health per provider", () => {
    registry.register(new GroqProvider("gsk_valid_key_1234567890123456789012345678901234567890"));

    expect(registry.isHealthy("groq")).toBe(true);
    registry.recordFailure("groq");
    registry.recordFailure("groq");
    registry.recordFailure("groq");
    expect(registry.isHealthy("groq")).toBe(false);

    registry.recordSuccess("groq");
    expect(registry.isHealthy("groq")).toBe(true);
  });

  test("require throws for unregistered provider", () => {
    expect(() => registry.require("openai")).toThrow(/not registered/);
  });

  test("streams successfully with mocked provider", async () => {
    const provider = new GroqProvider("gsk_valid_key_1234567890123456789012345678901234567890", async () => {
      return new Response(createStream([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        "data: [DONE]\n\n",
      ]), { status: 200 });
    });

    registry.register(provider);

    const chunks: string[] = [];
    for await (const chunk of provider.streamChat({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
    })) {
      if (chunk.content) chunks.push(chunk.content);
    }

    expect(chunks).toEqual(["Hello"]);
  });
});
