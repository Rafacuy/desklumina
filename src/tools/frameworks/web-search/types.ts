import type {
  ToolExecutionResult,
  WebSearchExtraData,
  WebSearchResultItem,
} from "../../../types";

// the provider ids. order in this union doesnt matter for logic, the
// actual chain order lives in provider-chain.ts (PROVIDER_ORDER)
export type SearchProviderId = "serper" | "serpapi" | "searxng" | "tavily";
export type SearchType = "web" | "news" | "images";
export type TimeRange = "day" | "week" | "month" | "year";

// normalized request that every adapter receives. parse-request.ts builds this
export interface SearchRequest {
  query: string;
  provider: SearchProviderId | "auto";
  type: SearchType;
  limit: number;
  language?: string;
  country?: string;
  timeRange?: TimeRange;
  includeRawContent: boolean;
  includeImages: boolean;
  safeSearch: boolean;
}

// what adapters return on failure. keep it discriminated - isProviderError
// relies on `kind` being set, so dont add non-error returns to this shape
export interface ProviderError {
  kind:
    | "configuration"
    | "authentication"
    | "rate-limit"
    | "timeout"
    | "network"
    | "malformed-response"
    | "empty-results"
    | "provider-unavailable"
    | "unsupported-capability"
    | "invalid-request";
  message: string;
  provider: SearchProviderId;
  status?: number;
  retriable: boolean;
}

// happy path return. `warnings` is for non-fatal stuff like dropped results
export interface ProviderResponse {
  provider: SearchProviderId;
  results: WebSearchResultItem[];
  warnings: string[];
  requestId?: string;
  answer?: {
    text: string;
    attributed: boolean;
  };
  metadata?: Record<string, unknown>;
}

// the adapter contract; every provider in ./providers/ implements this.
// timeout is enforced by orchestrator, not the adapter itself
export type ProviderAdapter = (
  request: SearchRequest,
  timeoutMs: number,
  fetcher: typeof fetch,
) => Promise<ProviderResponse | ProviderError>;

// lets tests inject a mock fetch without monkey-patching globalThis
export interface WebSearchOptions {
  fetcher?: typeof fetch;
}

// type guard; used when user-supplied strings could be a provider id
export function isSearchProviderId(value: string): value is SearchProviderId {
  return ["serper", "serpapi", "searxng", "tavily"].includes(value);
}

export type { ToolExecutionResult, WebSearchExtraData, WebSearchResultItem };
