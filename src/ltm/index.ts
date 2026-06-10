import { logger } from "../logger";
import { settingsManager } from "../core/services/settings-manager";
import { extractMemories } from "./pipeline/extractor";
import { formatMemoryBlock } from "./utils/formatter";
import { retrieveMemory } from "./pipeline/retriever";

export { LtmStore } from "./storage/storage";
export {
  _resetLtmRuntimeForTesting,
  _setLtmStoreForTesting,
  closeLtmStore,
  getLtmStore,
  initializeLtm,
} from "./core/runtime";
export {
  callExtractionLLM,
  extractMemories,
  generateEmbedding,
  parseExtractionResult,
  resolveEmbeddingProvider,
  resolveExtractionProvider,
} from "./pipeline/extractor";
export { calculateEpisodicScore, evictIfOverCap } from "./pipeline/evictor";
export { formatMemoryBlock } from "./utils/formatter";
export { retrieveMemory } from "./pipeline/retriever";
export type { EpisodicVectorEntry, ExtractionResult, LayerType, LtmEntry, LtmPromptPayload } from "./core/types";

export async function buildLtmContext(query: string): Promise<string> {
  const settings = settingsManager.get();
  if (!settings.features.ltm) return "";

  const payload = await retrieveMemory(query);
  if (payload.isEmpty) return "";

  const text = formatMemoryBlock(payload, settings.ltm.tokenBudget);
  if (text) {
    logger.debug?.(
      "ltm",
      `LTM injected: facts=${payload.facts.length}, patterns=${payload.patterns.length}, episodic=${payload.episodic.length}`
    );
  }
  return text;
}

let extractionQueue: Promise<void> = Promise.resolve();

export function triggerLtmExtraction(userMessage: string, assistantResponse: string): void {
  if (!settingsManager.get().features.ltm) return;

  extractionQueue = extractionQueue.then(() =>
    extractMemories(userMessage, assistantResponse).catch((error) => {
      logger.debug("ltm:extract", `Extraction failed: ${String(error)}`);
    })
  );
}
