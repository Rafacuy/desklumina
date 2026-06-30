import { env } from "../../../config/env";
import { settingsManager } from "../../../core/services/settings-manager";
import type { SearchProviderId } from "./types";
import { isSearchProviderId } from "./types";

const DEFAULT_TIMEOUT_MS = 8000;

// try order for "auto". 
// tavily first cuz its the most reliable and has the
// best answers, searxng last cuz its free but flaky. 
// reorder here if you wanna change the priority
const PROVIDER_ORDER: SearchProviderId[] = ["tavily", "serper", "serpapi", "searxng"];

export function resolveTimeout(): number {
  return env.DESKLUMINA_WEB_SEARCH_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS;
}

// where to look for the provider: explicit arg > user setting > env > auto
export function resolveProviderPreference(
  requested: string | undefined,
): SearchProviderId | "auto" {
  if (requested && isSearchProviderId(requested)) return requested;
  if (requested === "auto") return "auto";
  const fromSettings = settingsManager.get().webSearch?.defaultProvider;
  if (fromSettings && (isSearchProviderId(fromSettings) || fromSettings === "auto")) return fromSettings;
  const fromEnv = env.DESKLUMINA_WEB_SEARCH_PROVIDER;
  if (fromEnv && (isSearchProviderId(fromEnv) || fromEnv === "auto")) return fromEnv;
  return "auto";
}

export function isProviderConfigured(provider: SearchProviderId): boolean {
  switch (provider) {
    case "serper":
      return Boolean(env.SERPER_API_KEY);
    case "serpapi":
      return Boolean(env.SERPAPI_API_KEY);
    case "searxng":
      return Boolean(env.SEARXNG_BASE_URL);
    case "tavily":
      return Boolean(env.TAVILY_API_KEY);
  }
}

export function buildProviderChain(preferred: SearchProviderId | "auto"): SearchProviderId[] {
  if (preferred !== "auto") return [preferred];
  return PROVIDER_ORDER.filter((p) => isProviderConfigured(p));
}
