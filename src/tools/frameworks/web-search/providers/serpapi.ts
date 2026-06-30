// SerpAPI Adapter.
//
// Same shape as serper, see the comment block there for the full adapter pattern. 
// serpapi uses GET wiwth query params (vs serper's POST body)
// and uses `tbm=nws/isch` for news/images instead of separate endpoints
import { withTimeout } from "../../../../utils/async";
import { normalizeDate } from "../../../../utils/formatting/format";
import { normalizeUrl, sourceFromUrl } from "../../../../utils/url";
import { env } from "../../../../config/env";
import type { WebSearchResultItem } from "../../../../types";
import type {
  ProviderError,
  ProviderResponse,
  SearchRequest,
} from "../types";
import { classifyHttpStatus, providerError } from "../errors";

export async function adaptSerpApi(
  request: SearchRequest,
  timeoutMs: number,
  fetcher: typeof fetch,
): Promise<ProviderResponse | ProviderError> {
  const apiKey = env.SERPAPI_API_KEY;
  if (!apiKey) {
    return providerError("serpapi", "configuration", `Missing SERPAPI_API_KEY environment variable.`, undefined);
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", request.query);
  url.searchParams.set("api_key", apiKey);
  if (request.limit) url.searchParams.set("num", String(request.limit));
  if (request.country) url.searchParams.set("gl", request.country);
  if (request.language) url.searchParams.set("hl", request.language);
  if (request.safeSearch) url.searchParams.set("safe", "active");
  if (request.type === "news") url.searchParams.set("tbm", "nws");
  if (request.type === "images") url.searchParams.set("tbm", "isch");

  const controller = new AbortController();
  try {
    const response = await withTimeout(
      fetcher(url.toString(), {
        method: "GET",
        signal: controller.signal,
      }),
      timeoutMs,
      controller.signal,
    );

    if (!response.ok) {
      const kind = classifyHttpStatus("serpapi", response.status);
      return providerError("serpapi", kind, `SerpAPI returned HTTP ${response.status}.`, response.status);
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.error) {
      return providerError("serpapi", "invalid-request", String(data.error));
    }

    const warnings: string[] = [];
    const results: WebSearchResultItem[] = [];
    const rawItems = Array.isArray(data.organic_results) ? (data.organic_results as unknown[]) : [];
    if (!Array.isArray(data.organic_results)) {
      warnings.push("serpapi: missing organic_results");
    }

    let rank = 0;
    for (const item of rawItems) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const link = String(raw.link ?? "");
      const normalized = normalizeUrl(link);
      if (!normalized) {
        warnings.push("serpapi: dropped result with unsupported URL");
        continue;
      }
      rank++;
      results.push({
        title: String(raw.title ?? "Untitled"),
        url: normalized.url,
        snippet: String(raw.snippet ?? ""),
        source: sourceFromUrl(normalized.url),
        rank,
        provider: "serpapi",
        providerRank: typeof raw.position === "number" ? raw.position : rank,
        score: undefined,
        publishedDate: normalizeDate(raw.date),
        type: "organic",
        metadata: { providerField: "organic_results", originalPosition: raw.position },
      });
    }

    if (results.length === 0) {
      return providerError("serpapi", "empty-results", "SerpAPI returned no URL-bearing results.");
    }

    const metadata: Record<string, unknown> = {};
    if (data.search_metadata && typeof data.search_metadata === "object") {
      const sm = data.search_metadata as Record<string, unknown>;
      if (sm.id) metadata.searchId = sm.id;
      if (sm.status) metadata.searchStatus = sm.status;
    }

    return { provider: "serpapi", results, warnings, metadata };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "TIMEOUT" || msg === "ABORTED") {
      return providerError("serpapi", "timeout", "SerpAPI search timed out.");
    }
    return providerError("serpapi", "network", `Network error contacting SerpAPI: ${msg}`);
  }
}
