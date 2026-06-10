import { afterEach, describe, expect, test } from "bun:test";
import { settingsManager } from "../src/core/services/settings-manager";
import { LtmStore, retrieveMemory } from "../src/ltm";

const originalSettings = JSON.parse(JSON.stringify(settingsManager.get()));

afterEach(() => {
  settingsManager.set(JSON.parse(JSON.stringify(originalSettings)));
});

describe("LTM retriever", () => {
  test("returns empty payload when store is empty", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    const payload = await retrieveMemory("anything", store);

    expect(payload.isEmpty).toBe(true);
    expect(payload.facts).toHaveLength(0);
    expect(payload.patterns).toHaveLength(0);
    expect(payload.episodic).toHaveLength(0);
    store.close();
  });

  test("returns all facts and patterns when non-empty", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    store.upsertFact("name", "The user's name is Rapa.");
    store.upsertPattern("linux", "The user frequently asks about Linux.");

    const payload = await retrieveMemory("unrelated", store);

    expect(payload.isEmpty).toBe(false);
    expect(payload.facts.map((entry) => entry.value)).toContain("The user's name is Rapa.");
    expect(payload.patterns.map((entry) => entry.value)).toContain("The user frequently asks about Linux.");
    store.close();
  });

  test("falls back to lexical retrieval when query embedding is unavailable", async () => {
    settingsManager.set({
      ltm: {
        ...originalSettings.ltm,
        semanticRetrieval: { ...originalSettings.ltm.semanticRetrieval, enabled: true, topK: 5, threshold: 0.65 },
      },
    });

    const store = new LtmStore(":memory:");
    store.initialize();
    store.insertEpisodic("The user configured a custom Groq model.");
    store.insertEpisodic("The user discussed table formatting.");

    const payload = await retrieveMemory("Groq model", store, { queryEmbedding: null });

    expect(payload.episodic).toHaveLength(1);
    expect(payload.episodic[0].value).toContain("Groq");
    store.close();
  });

  test("ranks episodic entries by cosine similarity and respects threshold/topK", async () => {
    settingsManager.set({
      ltm: {
        ...originalSettings.ltm,
        semanticRetrieval: { ...originalSettings.ltm.semanticRetrieval, enabled: true, topK: 1, threshold: 0.65 },
      },
    });

    const store = new LtmStore(":memory:");
    store.initialize();
    store.insertEpisodic("Strong match", JSON.stringify([1, 0, 0]));
    store.insertEpisodic("Weak match", JSON.stringify([0.1, 1, 0]));

    const payload = await retrieveMemory("query", store, { queryEmbedding: [1, 0, 0] });

    expect(payload.episodic).toHaveLength(1);
    expect(payload.episodic[0].value).toBe("Strong match");
    store.close();
  });

  test("skips invalid and dimension-mismatched embeddings", async () => {
    settingsManager.set({
      ltm: {
        ...originalSettings.ltm,
        semanticRetrieval: { ...originalSettings.ltm.semanticRetrieval, enabled: true, topK: 5, threshold: 0.0 },
      },
    });

    const store = new LtmStore(":memory:");
    store.initialize();
    store.insertEpisodic("Broken JSON", "{bad}");
    store.insertEpisodic("Mismatched", JSON.stringify([1, 2]));
    store.insertEpisodic("Valid", JSON.stringify([1, 0, 0]));

    const payload = await retrieveMemory("query", store, { queryEmbedding: [1, 0, 0] });

    expect(payload.episodic.map((entry) => entry.value)).toEqual(["Valid"]);
    store.close();
  });
});
