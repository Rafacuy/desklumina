import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { logger } from "../../logger";
import type { EpisodicVectorEntry, LayerType, LtmEntry } from "../core/types";

interface MemoryRow {
  id: string;
  layer: LayerType;
  key: string | null;
  value: string;
  access_count: number;
  last_accessed: number;
  created_at: number;
  embedding?: string | null;
}

function expandPath(path: string): string {
  if (path === "~") return Bun.env.HOME!;
  if (path.startsWith("~/")) return `${Bun.env.HOME!}${path.slice(1)}`;
  return path;
}

function mapRow(row: MemoryRow): LtmEntry {
  return {
    id: row.id,
    layer: row.layer,
    key: row.key,
    value: row.value,
    accessCount: row.access_count,
    lastAccessed: row.last_accessed,
    createdAt: row.created_at,
  };
}

function sanitizeFtsQuery(query: string): string {
  const tokens = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"`).join(" ");
}

export class LtmStore {
  private db: Database | null = null;
  readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = expandPath(dbPath);
  }

  initialize(): void {
    const db = this.getDb();
    const ftsExisted = !!db.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'"
    ).get();
    db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL CHECK(layer IN ('fact', 'pattern', 'episodic')),
        key TEXT,
        value TEXT NOT NULL,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        embedding TEXT
      )
    `);
    db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_layer_key
      ON memories(layer, key)
      WHERE key IS NOT NULL AND layer IN ('fact', 'pattern')
    `);
    db.run("CREATE INDEX IF NOT EXISTS idx_memories_layer ON memories(layer)");
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_memories_episodic_score
      ON memories(layer, access_count, last_accessed)
      WHERE layer = 'episodic'
    `);
    db.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        value,
        content='memories',
        content_rowid='rowid',
        tokenize='trigram'
      )
    `);
    db.run(`
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, value) VALUES (new.rowid, new.value);
      END
    `);
    db.run(`
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, value) VALUES ('delete', old.rowid, old.value);
      END
    `);
    db.run(`
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, value) VALUES ('delete', old.rowid, old.value);
        INSERT INTO memories_fts(rowid, value) VALUES (new.rowid, new.value);
      END
    `);

    this.ensureEmbeddingColumn();
    if (!ftsExisted) {
      this.rebuildFtsIndex();
    }
  }

  close(): void {
    if (!this.db) return;
    this.db.close();
    this.db = null;
  }

  upsertFact(key: string, value: string): void {
    this.upsertKeyed("fact", key, value);
  }

  upsertPattern(key: string, value: string): void {
    this.upsertKeyed("pattern", key, value);
  }

  insertEpisodic(value: string, embedding: string | null = null): LtmEntry {
    const now = Date.now();
    const id = Bun.randomUUIDv7();
    this.getDb().query(`
      INSERT INTO memories (id, layer, key, value, access_count, last_accessed, created_at, embedding)
      VALUES ($id, 'episodic', NULL, $value, 0, $now, $now, $embedding)
    `).run({ id, value, now, embedding });
    const entry = this.getById(id);
    if (!entry) throw new Error(`Episodic insert succeeded but row not found: ${id}`);
    return entry;
  }

  getAllFacts(): LtmEntry[] {
    return this.getByLayer("fact");
  }

  getAllPatterns(): LtmEntry[] {
    return this.getByLayer("pattern");
  }

  getByKey(layer: "fact" | "pattern", key: string): LtmEntry | null {
    const row = this.getDb().query<MemoryRow, [string, string]>(
      "SELECT id, layer, key, value, access_count, last_accessed, created_at FROM memories WHERE layer = ? AND key = ?"
    ).get(layer, key);
    return row ? mapRow(row) : null;
  }

  hasEpisodicValue(value: string): boolean {
    const row = this.getDb().query<{ id: string }, [string]>(
      "SELECT id FROM memories WHERE layer = 'episodic' AND value = ? LIMIT 1"
    ).get(value);
    return row !== null;
  }

  searchEpisodic(query: string, limit: number): LtmEntry[] {
    const trimmed = query.trim();
    if (!trimmed || limit <= 0) return [];

    const ftsQuery = sanitizeFtsQuery(trimmed);
    if (!ftsQuery) return this.searchEpisodicLike(trimmed, limit);

    try {
      const rows = this.getDb().query<MemoryRow, [string, number]>(`
        SELECT m.id, m.layer, m.key, m.value, m.access_count, m.last_accessed, m.created_at
        FROM memories m
        JOIN memories_fts ON m.rowid = memories_fts.rowid
        WHERE m.layer = 'episodic'
          AND memories_fts MATCH ?
        ORDER BY bm25(memories_fts) ASC, m.access_count DESC, m.last_accessed DESC
        LIMIT ?
      `).all(ftsQuery, limit);
      if (rows.length === 0) {
        return this.searchEpisodicLike(trimmed, limit);
      }
      const entries = rows.map(mapRow);
      this.touchEntries(entries);
      return entries;
    } catch (error) {
      logger.debug("ltm:retriever", `FTS search failed, falling back to LIKE: ${String(error)}`);
      return this.searchEpisodicLike(trimmed, limit);
    }
  }

  getAllEpisodicWithEmbeddings(): EpisodicVectorEntry[] {
    return this.getDb().query<Required<MemoryRow>, []>(`
      SELECT id, layer, key, value, access_count, last_accessed, created_at, embedding
      FROM memories
      WHERE layer = 'episodic'
      ORDER BY created_at DESC
    `).all().map((row) => ({
      ...mapRow(row),
      embedding: row.embedding,
    }));
  }

  getEpisodicCount(): number {
    const row = this.getDb().query<{ count: number }, []>(
      "SELECT COUNT(*) AS count FROM memories WHERE layer = 'episodic'"
    ).get();
    return row?.count ?? 0;
  }

  evictEpisodic(count: number): void {
    if (count <= 0) return;
    const now = Date.now();
    this.getDb().query(`
      DELETE FROM memories
      WHERE id IN (
        SELECT id
        FROM memories
        WHERE layer = 'episodic'
        ORDER BY (
          access_count * (1.0 / (1.0 + (MAX(0, ? - last_accessed) / 3600000.0) / 24.0))
        ) ASC, last_accessed ASC, created_at ASC
        LIMIT ?
      )
    `).run(now, count);
  }

  touchEntry(id: string): void {
    this.touchEntriesById([id]);
  }

  touchEntriesById(ids: readonly string[]): void {
    if (ids.length === 0) return;

    const now = Date.now();
    const update = this.getDb().query(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed = $now
      WHERE id = $id
    `);

    for (const id of ids) {
      update.run({ id, now });
    }
  }

  clearLayer(layer: LayerType): void {
    this.getDb().query("DELETE FROM memories WHERE layer = ?").run(layer);
  }

  clearAll(): void {
    this.getDb().run("DELETE FROM memories");
  }

  private upsertKeyed(layer: "fact" | "pattern", key: string, value: string): void {
    const now = Date.now();
    this.getDb().query(`
      INSERT INTO memories (id, layer, key, value, access_count, last_accessed, created_at)
      VALUES ($id, $layer, $key, $value, 0, $now, $now)
      ON CONFLICT(layer, key) WHERE key IS NOT NULL AND layer IN ('fact', 'pattern')
      DO UPDATE SET value = excluded.value, last_accessed = excluded.last_accessed
    `).run({
      id: Bun.randomUUIDv7(),
      layer,
      key,
      value,
      now,
    });
  }

  private getById(id: string): LtmEntry | null {
    const row = this.getDb().query<MemoryRow, [string]>(
      "SELECT id, layer, key, value, access_count, last_accessed, created_at FROM memories WHERE id = ?"
    ).get(id);
    return row ? mapRow(row) : null;
  }

  private getByLayer(layer: "fact" | "pattern"): LtmEntry[] {
    return this.getDb().query<MemoryRow, [LayerType]>(`
      SELECT id, layer, key, value, access_count, last_accessed, created_at
      FROM memories
      WHERE layer = ?
      ORDER BY last_accessed DESC, created_at DESC
    `).all(layer).map(mapRow);
  }

  private searchEpisodicLike(query: string, limit: number): LtmEntry[] {
    const sanitized = query.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    if (!sanitized) return [];
    const escaped = sanitized.replace(/[%_\\]/g, "\\$&");
    const rows = this.getDb().query<MemoryRow, [string, number]>(`
      SELECT id, layer, key, value, access_count, last_accessed, created_at
      FROM memories
      WHERE layer = 'episodic' AND value LIKE '%' || ? || '%' ESCAPE '\\'
      ORDER BY access_count DESC, last_accessed DESC
      LIMIT ?
    `).all(escaped, limit);
    const entries = rows.map(mapRow);
    this.touchEntries(entries);
    return entries;
  }

  private touchEntries(entries: LtmEntry[]): void {
    this.touchEntriesById(entries.map((entry) => entry.id));
  }

  private ensureEmbeddingColumn(): void {
    const hasEmbedding = this.getDb().query<{ name: string }, []>("PRAGMA table_info(memories)").all()
      .some((column) => column.name === "embedding");

    if (!hasEmbedding) {
      this.getDb().run("ALTER TABLE memories ADD COLUMN embedding TEXT");
      logger.info("ltm:store", "Applied migration: added memories.embedding column");
    }
  }

  private rebuildFtsIndex(): void {
    try {
      this.getDb().run("INSERT INTO memories_fts(memories_fts) VALUES('rebuild')");
      logger.info("ltm:store", "Rebuilt FTS index with trigram tokenizer");
    } catch (error) {
      logger.debug("ltm:store", `FTS rebuild skipped: ${String(error)}`);
    }
  }

  private getDb(): Database {
    if (!this.db) {
      if (this.dbPath !== ":memory:") {
        mkdirSync(dirname(this.dbPath), { recursive: true });
      }
      this.db = new Database(this.dbPath, { strict: true });
    }
    return this.db;
  }
}
