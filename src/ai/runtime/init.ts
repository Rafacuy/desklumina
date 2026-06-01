import { providerRegistry, modelRegistry } from "../registry";

/**
 * registering all available providers and loading model overrides
 */
export function initializeAI(): void {
  providerRegistry.initialize();
  modelRegistry.initialize();
}
