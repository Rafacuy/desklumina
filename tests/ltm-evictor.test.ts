import { describe, expect, test } from "bun:test";
import { calculateEpisodicScore, evictIfOverCap, LtmStore } from "../src/ltm";
import type { LtmEntry } from "../src/ltm";

function entry(accessCount: number, lastAccessed: number): LtmEntry {
  return {
    id: crypto.randomUUID(),
    layer: "episodic",
    key: null,
    value: "memory",
    accessCount,
    lastAccessed,
    createdAt: lastAccessed,
  };
}

describe("LTM evictor", () => {
  test("score calculation weights access count and recency", () => {
    const now = Date.now();
    const recent = calculateEpisodicScore(entry(1, now), now);
    const old = calculateEpisodicScore(entry(1, now - 72 * 3600000), now);
    const frequent = calculateEpisodicScore(entry(3, now - 72 * 3600000), now);

    expect(recent).toBeGreaterThan(old);
    expect(frequent).toBeGreaterThan(old);
  });

  test("does not evict when count is below or equal cap", () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    store.insertEpisodic("One memory.");

    evictIfOverCap(store, 1);

    expect(store.getEpisodicCount()).toBe(1);
    store.close();
  });

  test("removes excess entries", () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    store.insertEpisodic("Memory one.");
    store.insertEpisodic("Memory two.");
    store.insertEpisodic("Memory three.");

    evictIfOverCap(store, 2);

    expect(store.getEpisodicCount()).toBe(2);
    store.close();
  });

  test("removes lowest-scored entries first", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    const low = store.insertEpisodic("Low score memory.");
    await Bun.sleep(2);
    const high = store.insertEpisodic("High score memory.");
    store.touchEntry(high.id);
    store.touchEntry(high.id);

    evictIfOverCap(store, 1);

    const remaining = store.searchEpisodic("memory", 10).map((item) => item.id);
    expect(remaining).toContain(high.id);
    expect(remaining).not.toContain(low.id);
    store.close();
  });
});
