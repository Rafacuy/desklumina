import { describe, expect, test } from "bun:test";
import {
  cosineSimilarity,
  isFiniteNumberArray,
  parseEmbeddingJson,
  serializeEmbedding,
  validateVectorPair,
} from "../src/ltm/utils/vector";

describe("LTM vector utils", () => {
  test("validates finite numeric vectors", () => {
    expect(isFiniteNumberArray([1, 2, 3])).toBe(true);
    expect(isFiniteNumberArray([])).toBe(false);
    expect(isFiniteNumberArray([1, Number.NaN])).toBe(false);
    expect(isFiniteNumberArray([1, Infinity])).toBe(false);
  });

  test("parses embedding JSON safely", () => {
    expect(parseEmbeddingJson("[0.1,-0.2,0.3]")).toEqual({
      ok: true,
      vector: [0.1, -0.2, 0.3],
      reason: null,
    });
    expect(parseEmbeddingJson("{bad}").ok).toBe(false);
    expect(parseEmbeddingJson(null).reason).toBe("missing");
    expect(parseEmbeddingJson("[]").reason).toBe("invalid-shape");
  });

  test("validates vector pair dimensions", () => {
    expect(validateVectorPair([1, 2], [3, 4]).ok).toBe(true);
    expect(validateVectorPair([1, 2], [3]).reason).toBe("dimension-mismatch");
  });

  test("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
    expect(cosineSimilarity([0, 0], [1, 0])).toBeNull();
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBeNull();
  });

  test("serializes valid embeddings", () => {
    expect(serializeEmbedding([0.1, -0.2, 0.3])).toBe("[0.1,-0.2,0.3]");
    expect(serializeEmbedding([])).toBeNull();
  });
});
