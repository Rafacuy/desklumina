import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { LtmStore } from "../src/ltm";

const tempDirs: string[] = [];

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "desklumina-ltm-"));
  tempDirs.push(dir);
  return join(dir, "ltm.db");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("LtmStore", () => {
  test("creates schema idempotently and creates database file", () => {
    const path = tempDbPath();
    const store = new LtmStore(path);

    store.initialize();
    store.initialize();

    expect(existsSync(path)).toBe(true);
    store.close();
    store.close();
  });

  test("upserts facts and patterns by layer/key", () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    store.upsertFact("name", "The user's name is Rapa.");
    store.upsertFact("name", "The user's preferred name is Rapa.");
    store.upsertPattern("linux", "The user frequently asks about Linux.");
    store.upsertPattern("linux", "The user frequently asks about Linux administration.");

    const facts = store.getAllFacts();
    const patterns = store.getAllPatterns();

    expect(facts).toHaveLength(1);
    expect(facts[0].value).toBe("The user's preferred name is Rapa.");
    expect(patterns).toHaveLength(1);
    expect(patterns[0].value).toBe("The user frequently asks about Linux administration.");
    store.close();
  });

  test("inserts episodic memories and searches with FTS5", () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    store.insertEpisodic("The user configured a custom Groq model for the daemon.");
    store.insertEpisodic("The user asked about table formatting.");

    const results = store.searchEpisodic("Groq daemon", 5);

    expect(results).toHaveLength(1);
    expect(results[0].value).toContain("Groq");
    expect(store.getEpisodicCount()).toBe(2);
    store.close();
  });

  test("stores and loads episodic embeddings as JSON strings", () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    store.insertEpisodic("The user configured semantic retrieval.", "[0.1,-0.2,0.3]");

    const episodic = store.getAllEpisodicWithEmbeddings();
    expect(episodic).toHaveLength(1);
    expect(episodic[0].embedding).toBe("[0.1,-0.2,0.3]");
    store.close();
  });

  test("applies safe migration for legacy databases missing embedding column", () => {
    const path = tempDbPath();
    const db = new Database(path, { strict: true });
    db.run(`
      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL CHECK(layer IN ('fact', 'pattern', 'episodic')),
        key TEXT,
        value TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    db.run(`
      INSERT INTO memories (id, layer, key, value, access_count, last_accessed, created_at)
      VALUES ('legacy-1', 'episodic', NULL, 'Legacy memory row', 0, 1, 1)
    `);
    db.close();

    const store = new LtmStore(path);
    store.initialize();

    const episodic = store.getAllEpisodicWithEmbeddings();
    expect(episodic).toHaveLength(1);
    expect(episodic[0].value).toBe("Legacy memory row");
    expect(episodic[0].embedding).toBeNull();

    const verifyDb = new Database(path, { strict: true });
    const columns = verifyDb.query<{ name: string }, []>("PRAGMA table_info(memories)").all().map((c) => c.name);
    expect(columns).toContain("embedding");
    verifyDb.close();
    store.close();
  });

  test("falls back to LIKE search when FTS query syntax fails", () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    store.insertEpisodic("The user debugged an unmatched parenthesis issue.");

    const results = store.searchEpisodic("parenthesis issue (", 5);

    expect(results).toHaveLength(1);
    expect(results[0].value).toContain("parenthesis");
    store.close();
  });

  test("touchEntry increments access count and updates last accessed", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();
    const entry = store.insertEpisodic("The user asked to inspect logs.");

    await Bun.sleep(2);
    store.touchEntry(entry.id);
    const [touched] = store.searchEpisodic("logs", 1);

    expect(touched.accessCount).toBeGreaterThanOrEqual(1);
    expect(touched.lastAccessed).toBeGreaterThan(entry.lastAccessed);
    store.close();
  });

  test("evicts lowest-scored episodic entries", async () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    const oldLowScore = store.insertEpisodic("Old low score memory.");
    await Bun.sleep(2);
    const kept = store.insertEpisodic("Frequently accessed memory.");
    store.touchEntry(kept.id);
    store.touchEntry(kept.id);

    store.evictEpisodic(1);

    const remaining = store.searchEpisodic("memory", 10).map((entry) => entry.id);
    expect(remaining).toContain(kept.id);
    expect(remaining).not.toContain(oldLowScore.id);
    store.close();
  });

  test("clearLayer and clearAll remove expected entries", () => {
    const store = new LtmStore(":memory:");
    store.initialize();

    store.upsertFact("name", "The user's name is Rapa.");
    store.upsertPattern("linux", "The user asks about Linux.");
    store.insertEpisodic("The user configured a daemon.");

    store.clearLayer("fact");
    expect(store.getAllFacts()).toHaveLength(0);
    expect(store.getAllPatterns()).toHaveLength(1);
    expect(store.getEpisodicCount()).toBe(1);

    store.clearAll();
    expect(store.getAllPatterns()).toHaveLength(0);
    expect(store.getEpisodicCount()).toBe(0);
    store.close();
  });
});
