import { afterEach, describe, expect, test } from "bun:test";
import {
  _resetLtmRuntimeForTesting,
  _setLtmStoreForTesting,
  callExtractionLLM,
  extractMemories,
  generateEmbedding,
  LtmStore,
  parseExtractionResult,
  resolveEmbeddingProvider,
  resolveExtractionProvider,
} from "../src/ltm";
import { settingsManager } from "../src/core/services/settings-manager";
import { providerRegistry, modelRegistry } from "../src/ai/registry";
import type {
  AIProvider,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderRequest,
  ProviderStreamChunk,
  ProviderCapability,
  ProviderValidationResult,
} from "../src/ai/types";

class FakeProvider implements AIProvider {
  readonly name = "Fake";
  readonly embed?: (request: EmbeddingRequest) => Promise<EmbeddingResponse>;

  constructor(
    readonly id: AIProvider["id"],
    private readonly handler: (request: ProviderRequest) => AsyncGenerator<ProviderStreamChunk>,
    embedding?: (request: EmbeddingRequest) => Promise<EmbeddingResponse>
  ) {
    this.embed = embedding;
  }

  streamChat(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk> {
    return this.handler(request);
  }

  validateConfig(): ProviderValidationResult {
    return { ok: true, errors: [] };
  }

  capabilities(): ProviderCapability {
    return {
      maxContextTokens: 8192,
      streamingSupported: true,
      visionSupported: false,
      jsonModeSupported: false,
      functionCallingSupported: false,
      embeddingsSupported: typeof this.embed === "function",
    };
  }
}

const originalSettings = JSON.parse(JSON.stringify(settingsManager.get()));
const originalModel = Bun.env.DESKLUMINA_MODEL;

function registerProvider(
  id: AIProvider["id"],
  chunks: string[],
  embedding?: (request: EmbeddingRequest) => Promise<EmbeddingResponse>
): FakeProvider {
  const provider = new FakeProvider(id, async function* () {
    for (const chunk of chunks) {
      yield { content: chunk };
    }
  }, embedding);
  providerRegistry.register(provider);
  return provider;
}

afterEach(() => {
  settingsManager.set(JSON.parse(JSON.stringify(originalSettings)));
  providerRegistry.reset();
  modelRegistry.initialize();
  _resetLtmRuntimeForTesting();
  if (originalModel === undefined) {
    delete Bun.env.DESKLUMINA_MODEL;
  } else {
    Bun.env.DESKLUMINA_MODEL = originalModel;
  }
});

describe("LTM extractor", () => {
  test("parseExtractionResult parses valid JSON", () => {
    const result = parseExtractionResult(JSON.stringify({
      facts: [{ key: "name", value: "The user's name is Rapa." }],
      patterns: [],
      episodic: [{ value: "The user configured Groq." }],
    }));

    expect(result?.facts[0].key).toBe("name");
    expect(result?.episodic[0].value).toContain("Groq");
  });

  test("parseExtractionResult handles fenced JSON", () => {
    const result = parseExtractionResult(`\`\`\`json
{"facts":[],"patterns":[{"key":"linux","value":"The user asks about Linux."}],"episodic":[]}
\`\`\``);

    expect(result?.patterns).toHaveLength(1);
    expect(result?.patterns[0].key).toBe("linux");
  });

  test("parseExtractionResult returns null for malformed JSON", () => {
    expect(parseExtractionResult("{not-json")).toBeNull();
  });

  test("parseExtractionResult filters entries missing required fields", () => {
    const result = parseExtractionResult(JSON.stringify({
      facts: [{ key: "", value: "skip" }, { key: "timezone", value: "The user lives in Jakarta." }],
      patterns: [{ key: "bad", value: "" }],
      episodic: [{ value: "" }, { value: "The user asked about systemd." }],
    }));

    expect(result?.facts).toHaveLength(1);
    expect(result?.patterns).toHaveLength(0);
    expect(result?.episodic).toHaveLength(1);
  });

  test("resolveExtractionProvider returns configured provider when set", () => {
    const provider = registerProvider("groq", []);
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "groq", model: "llama-test", embedModel: "" },
    });

    const resolved = resolveExtractionProvider();

    expect(resolved?.provider).toBe(provider);
    expect(resolved?.model).toBe("llama-test");
  });

  test("resolveExtractionProvider falls back to main provider when unconfigured", () => {
    const provider = registerProvider("openai", []);
    Bun.env.DESKLUMINA_MODEL = "openai:gpt-test";
    modelRegistry.initialize();
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "", model: "", embedModel: "" },
    });

    const resolved = resolveExtractionProvider();

    expect(resolved?.provider).toBe(provider);
    expect(resolved?.model).toBe("gpt-test");
  });

  test("callExtractionLLM consumes streaming chunks", async () => {
    const provider = registerProvider("openai", ["{\"facts\":", "[],\"patterns\":[],\"episodic\":[]}"]);

    const response = await callExtractionLLM(provider, "gpt-test", [{ role: "user", content: "extract" }]);

    expect(response).toBe("{\"facts\":[],\"patterns\":[],\"episodic\":[]}");
  });

  test("callExtractionLLM aborts on timeout", async () => {
    let signal: AbortSignal | undefined;
    const provider = new FakeProvider("openai", async function* (request) {
      signal = request.signal;
      await Bun.sleep(50);
      yield { content: "{}" };
    });

    await expect(callExtractionLLM(provider, "gpt-test", [{ role: "user", content: "extract" }], 5))
      .rejects.toThrow("timed out");
    expect(signal?.aborted).toBe(true);
  });

  test("extractMemories writes parsed memories", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);
    registerProvider(
      "openai",
      [
        JSON.stringify({
          facts: [{ key: "name", value: "The user's name is Rapa." }],
          patterns: [{ key: "linux", value: "The user asks about Linux." }],
          episodic: [{ value: "The user configured Groq." }],
        }),
      ],
      async () => ({ embedding: [0.5, 0.25, -0.1] })
    );
    settingsManager.set({
      features: { ...originalSettings.features, ltm: true },
      ltm: { ...originalSettings.ltm, provider: "openai", model: "gpt-test", embedModel: "" },
    });

    await extractMemories("remember this", "done");

    expect(store.getAllFacts()).toHaveLength(1);
    expect(store.getAllPatterns()).toHaveLength(1);
    expect(store.getEpisodicCount()).toBe(1);
    expect(store.getAllEpisodicWithEmbeddings()[0].embedding).toBe("[0.5,0.25,-0.1]");
  });

  test("extractMemories catches provider errors", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);
    providerRegistry.register(new FakeProvider("openai", async function* () {
      throw new Error("provider failed");
    }));
    settingsManager.set({
      features: { ...originalSettings.features, ltm: true },
      ltm: { ...originalSettings.ltm, provider: "openai", model: "gpt-test", embedModel: "" },
    });

    await expect(extractMemories("hello", "world")).resolves.toBeUndefined();
    expect(store.getAllFacts()).toHaveLength(0);
  });

  test("resolveEmbeddingProvider returns null when provider has no embedding support", () => {
    registerProvider("anthropic", [], undefined);
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "anthropic", model: "claude-test", embedModel: "" },
    });

    const resolved = resolveEmbeddingProvider();

    expect(resolved).toBeNull();
  });

  test("generateEmbedding returns vector when provider supports embeddings", async () => {
    registerProvider("openai", [], async () => ({ embedding: [0.1, -0.2, 0.3] }));
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "openai", model: "text-embedding-test", embedModel: "" },
    });

    await expect(generateEmbedding("hello memory")).resolves.toEqual([0.1, -0.2, 0.3]);
  });

  test("extractMemories stores episodic row when embedding generation fails", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    _setLtmStoreForTesting(store);

    registerProvider(
      "openai",
      [
        JSON.stringify({
          facts: [],
          patterns: [],
          episodic: [{ value: "Important meeting on June 20." }],
        }),
      ],
      async () => {
        throw new Error("embedding endpoint unavailable");
      }
    );

    settingsManager.set({
      features: { ...originalSettings.features, ltm: true },
      ltm: { ...originalSettings.ltm, provider: "openai", model: "gpt-test", embedModel: "" },
    });

    await extractMemories("remember", "ok");

    const episodic = store.getAllEpisodicWithEmbeddings();
    expect(episodic).toHaveLength(1);
    expect(episodic[0].embedding).toBeNull();
  });

  test("resolveEmbeddingProvider uses ltm.embedModel bare id with configured provider", async () => {
    const calls: string[] = [];
    registerProvider("openai", [], async (request) => {
      calls.push(request.model);
      return { embedding: [0.9, 0.8, 0.7] };
    });
    settingsManager.set({
      ltm: {
        ...originalSettings.ltm,
        provider: "openai",
        model: "gpt-chat-model",
        embedModel: "text-embedding-3-small",
      },
    });

    const resolved = resolveEmbeddingProvider();

    expect(resolved?.provider.id).toBe("openai");
    expect(resolved?.model).toBe("text-embedding-3-small");

    await expect(generateEmbedding("hi")).resolves.toEqual([0.9, 0.8, 0.7]);
    expect(calls).toEqual(["text-embedding-3-small"]);
  });

  test("resolveEmbeddingProvider parses ltm.embedModel as provider:model overriding ltm.provider", () => {
    registerProvider("anthropic", [], undefined);
    registerProvider("gemini", [], async () => ({ embedding: [1, 0, 0] }));
    settingsManager.set({
      ltm: {
        ...originalSettings.ltm,
        provider: "anthropic",
        model: "claude-test",
        embedModel: "gemini:text-embedding-004",
      },
    });

    const resolved = resolveEmbeddingProvider();

    expect(resolved?.provider.id).toBe("gemini");
    expect(resolved?.model).toBe("text-embedding-004");
  });

  test("resolveEmbeddingProvider falls back to DESKLUMINA_EMBED_MODEL env var", () => {
    registerProvider("anthropic", [], undefined);
    registerProvider("openai", [], async () => ({ embedding: [0.5] }));
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "anthropic", model: "claude-test", embedModel: "" },
    });

    const originalEmbedEnv = Bun.env.DESKLUMINA_EMBED_MODEL;
    Bun.env.DESKLUMINA_EMBED_MODEL = "openai:text-embedding-3-small";
    try {
      const resolved = resolveEmbeddingProvider();
      expect(resolved?.provider.id).toBe("openai");
      expect(resolved?.model).toBe("text-embedding-3-small");
    } finally {
      if (originalEmbedEnv === undefined) {
        delete Bun.env.DESKLUMINA_EMBED_MODEL;
      } else {
        Bun.env.DESKLUMINA_EMBED_MODEL = originalEmbedEnv;
      }
    }
  });

  test("resolveEmbeddingProvider falls back to chat model when it supports embeddings (legacy config)", () => {
    registerProvider("openai", [], async () => ({ embedding: [0.1] }));
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "openai", model: "text-embedding-3-small", embedModel: "" },
    });

    const resolved = resolveEmbeddingProvider();

    expect(resolved?.provider.id).toBe("openai");
    expect(resolved?.model).toBe("text-embedding-3-small");
  });

  test("resolveEmbeddingProvider walks main fallback chain for embedding-capable provider", () => {
    registerProvider("anthropic", [], undefined);
    registerProvider("openai", [], async () => ({ embedding: [0.42] }));
    Bun.env.DESKLUMINA_MODEL = "anthropic:claude-test";
    Bun.env.DESKLUMINA_FALLBACKS = "openai:gpt-test";
    modelRegistry.initialize();
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "anthropic", model: "claude-test", embedModel: "" },
    });

    const resolved = resolveEmbeddingProvider();

    expect(resolved?.provider.id).toBe("openai");
    expect(resolved?.model).toBe("gpt-test");

    delete Bun.env.DESKLUMINA_FALLBACKS;
  });

  test("resolveEmbeddingProvider ignores embedModel referencing unregistered provider", () => {
    registerProvider("openai", [], async () => ({ embedding: [0.1] }));
    settingsManager.set({
      ltm: {
        ...originalSettings.ltm,
        provider: "openai",
        model: "gpt-test",
        embedModel: "huggingface:BAAI/bge-large",
      },
    });

    const resolved = resolveEmbeddingProvider();

    // huggingface is not registered -> fall back to openai chat model (which supports embeddings here).
    expect(resolved?.provider.id).toBe("openai");
    expect(resolved?.model).toBe("gpt-test");
  });

  test("resolveEmbeddingProvider returns null for malformed embedModel without fallback", () => {
    registerProvider("anthropic", [], undefined);
    settingsManager.set({
      ltm: { ...originalSettings.ltm, provider: "anthropic", model: "claude-test", embedModel: "  :  " },
    });

    expect(resolveEmbeddingProvider()).toBeNull();
  });
});
