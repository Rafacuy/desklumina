import { logger } from "../../logger";
import { settingsManager } from "../../core/services/settings-manager";
import { getLtmStore } from "../core/runtime";
import type { LtmPromptPayload } from "../core/types";
import type { LtmStore } from "../storage/storage";
import { cosineSimilarity, parseEmbeddingJson } from "../utils/vector";
import { generateEmbedding } from "./extractor";

const EMPTY_PAYLOAD: LtmPromptPayload = {
  facts: [],
  patterns: [],
  episodic: [],
  isEmpty: true,
};

function normalizeTopK(topK: number): number {
  return Math.max(1, Math.floor(topK));
}

function normalizeThreshold(threshold: number): number {
  if (!Number.isFinite(threshold)) return 0.65;
  return Math.max(-1, Math.min(1, threshold));
}

export async function retrieveMemory(
  query: string,
  store: LtmStore | null = getLtmStore(),
  options?: { queryEmbedding?: number[] | null }
): Promise<LtmPromptPayload> {
  if (!store) return EMPTY_PAYLOAD;

  const settings = settingsManager.get();
  const facts = store.getAllFacts();
  const patterns = store.getAllPatterns();
  const topK = normalizeTopK(settings.ltm.semanticRetrieval.topK);

  if (!settings.ltm.semanticRetrieval.enabled) {
    const episodic = store.searchEpisodic(query, topK);
    return {
      facts,
      patterns,
      episodic,
      isEmpty: facts.length === 0 && patterns.length === 0 && episodic.length === 0,
    };
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return {
      facts,
      patterns,
      episodic: [],
      isEmpty: facts.length === 0 && patterns.length === 0,
    };
  }

  const rows = store.getAllEpisodicWithEmbeddings();
  const hasEmbeddings = rows.some((row) => row.embedding != null);
  if (!hasEmbeddings) {
    logger.debug("ltm:retrieval", "Semantic retrieval skipped: no episodic entries with embeddings");
    const episodic = store.searchEpisodic(trimmed, topK);
    return {
      facts,
      patterns,
      episodic,
      isEmpty: facts.length === 0 && patterns.length === 0 && episodic.length === 0,
    };
  }

  const queryEmbedding = options?.queryEmbedding === undefined
    ? await generateEmbedding(trimmed)
    : options.queryEmbedding;
  if (!queryEmbedding) {
    logger.debug("ltm:retrieval", "Semantic retrieval skipped: query embedding unavailable");
    const episodic = store.searchEpisodic(trimmed, topK);
    return {
      facts,
      patterns,
      episodic,
      isEmpty: facts.length === 0 && patterns.length === 0 && episodic.length === 0,
    };
  }

  const threshold = normalizeThreshold(settings.ltm.semanticRetrieval.threshold);

  let scoredCount = 0;
  const matches: Array<{ id: string; score: number; entry: typeof rows[number] }> = [];

  for (const row of rows) {
    const parsed = parseEmbeddingJson(row.embedding);
    if (!parsed.ok || !parsed.vector) {
      if (parsed.reason !== "missing") {
        logger.debug("ltm:retrieval", `ltm:vector invalid id=${row.id} reason=${parsed.reason}`);
      }
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, parsed.vector);
    if (score === null) {
      logger.debug("ltm:retrieval", `ltm:vector invalid id=${row.id} reason=dimension-mismatch`);
      continue;
    }

    scoredCount++;
    if (score >= threshold) {
      matches.push({ id: row.id, score, entry: row });
    }
  }

  matches.sort((a, b) => b.score - a.score || b.entry.lastAccessed - a.entry.lastAccessed);

  const selected = matches.slice(0, topK).map((item) => item.entry);
  store.touchEntriesById(selected.map((item) => item.id));

  logger.debug("ltm:retrieval", `ltm:retrieval scored=${scoredCount}`);
  logger.debug("ltm:retrieval", `ltm:retrieval matched=${selected.length} threshold=${threshold}`);

  return {
    facts,
    patterns,
    episodic: selected,
    isEmpty: facts.length === 0 && patterns.length === 0 && selected.length === 0,
  };
}
