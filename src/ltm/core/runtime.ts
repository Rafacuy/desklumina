import { logger } from "../../logger";
import { settingsManager } from "../../core/services/settings-manager";
import { LtmStore } from "../storage/storage";

let store: LtmStore | null = null;
let disabled = false;
let exitHandlerInstalled = false;

export function initializeLtm(dbPathOverride?: string): void {
  if (store || disabled) return;

  try {
    const dbPath = dbPathOverride || settingsManager.get().ltm.dbPath;
    store = new LtmStore(dbPath);
    store.initialize();
    logger.info("ltm", `LTM initialized: dbPath=${store.dbPath}`);
    installExitHandler();
  } catch (error) {
    disabled = true;
    store = null;
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("ltm:store", `LTM store error: ${err.message}`, err);
  }
}

export function getLtmStore(): LtmStore | null {
  if (!store && !disabled) {
    initializeLtm();
  }
  return store;
}

export function closeLtmStore(): void {
  store?.close();
  store = null;
}

export function _setLtmStoreForTesting(testStore: LtmStore | null): void {
  closeLtmStore();
  disabled = false;
  store = testStore;
}

export function _resetLtmRuntimeForTesting(): void {
  closeLtmStore();
  disabled = false;
}

function installExitHandler(): void {
  if (exitHandlerInstalled) return;
  exitHandlerInstalled = true;
  process.on("exit", closeLtmStore);
}
