import { logger } from "../../logger";
import type { LtmEntry } from "../core/types";
import type { LtmStore } from "../storage/storage";

export function calculateEpisodicScore(entry: LtmEntry, now = Date.now()): number {
  const hoursSinceLastAccess = Math.max(0, now - entry.lastAccessed) / 3600000;
  const recencyWeight = 1.0 / (1.0 + hoursSinceLastAccess / 24.0);
  return entry.accessCount * recencyWeight;
}

export function evictIfOverCap(store: LtmStore, cap: number): void {
  const normalizedCap = Math.max(0, Math.floor(cap));
  const count = store.getEpisodicCount();
  if (count <= normalizedCap) return;

  const excess = count - normalizedCap;
  store.evictEpisodic(excess);
  logger.debug("ltm:evict", `Evicted ${excess} episodic entries (cap=${normalizedCap})`);
}
