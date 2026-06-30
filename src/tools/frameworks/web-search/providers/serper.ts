// Serper Adapter. 
//
// This is the "canonical" one, look here first when adding
// a new provider, the others follow the same shape:
//   1) check config, bail w/ "configuration" error if missing
//   2) build url/body
//   3) withTimeout'd fetch
//   4) classify non-2xx via classifyHttpStatus
//   5) normalize each result into WebSearchResultItem
//   6) return ProviderResponse, or ProviderError on empty
import { withTimeout } from "../../../../utils/async";
import { normalizeDate } from "../../../../utils/formatting/format";
import { normalizeUrl, sourceFromUrl } from "../../../../utils/url";
import { env } from "../../../../config/env";
import type { WebSearchResultItem } from "../../../../types";
import type {
  ProviderError,
  ProviderResponse,
  SearchRequest,
  SearchType,
} from "../types";
import { classifyHttpStatus, providerError } from "../errors";

export async function adaptSerper(
  request: SearchRequest,
  timeoutMs: number,
  fetcher: typeof fetch,
): Promise<ProviderResponse | ProviderError> {
  const apiKey = env.SERPER_API_KEY;
  if (!apiKey) {
    return providerError("serper", "configuration", `Missing SERPER_API_KEY environment variable.`, undefined);
  }

  const endpointMap: Record<SearchType, string> = {
    web: "search",
    news: "news",
    images: "images",
  };
  const endpoint = endpointMap[request.type] ?? "search";
  const url = `https://google.serper.dev/${endpoint}`;
  const body: Record<string, unknown> = { q: request.query };
  if (request.limit) body.num = request.limit;
  if (request.country) body.gl = request.country;
  if (request.language) body.hl = request.language;
  if (request.safeSearch) body.safe = "active";

  const controller = new AbortController();
  try {
    const response = await withTimeout(
      fetcher(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }),
      timeoutMs,
      controller.signal,
    );

    if (!response.ok) {
      const kind = classifyHttpStatus("serper", response.status);
      return providerError("serper", kind, `Serper returned HTTP ${response.status}.`, response.status);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const warnings: string[] = [];
    const results: WebSearchResultItem[] = [];

    const arrayField =
      endpoint === "news"
        ? (data.news as unknown[])
        : endpoint === "images"
        ? (data.images as unknown[])
        : (data.organic as unknown[]);

    const rawItems = Array.isArray(arrayField) ? arrayField : [];
    if (!Array.isArray(arrayField)) {
      warnings.push("serper: missing expected result array");
    }

    let rank = 0;
    for (const item of rawItems) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const link = String(raw.link ?? "");
      const normalized = normalizeUrl(link);
      if (!normalized) {
        warnings.push("serper: dropped result with unsupported URL");
        continue;
      }
      rank++;
      results.push({
        title: String(raw.title ?? "Untitled"),
        url: normalized.url,
        snippet: String(raw.snippet ?? ""),
        source: sourceFromUrl(normalized.url),
        rank,
        provider: "serper",
        providerRank: typeof raw.position === "number" ? raw.position : rank,
        score: undefined,
        publishedDate: normalizeDate(raw.date),
        type: endpoint === "news" ? "news" : endpoint === "images" ? "image" : "organic",
        thumbnailUrl: raw.imageUrl ? String(raw.imageUrl) : undefined,
        metadata: { providerField: "organic", originalPosition: raw.position },
      });
    }

    if (results.length === 0) {
      return providerError("serper", "empty-results", "Serper returned no URL-bearing results.");
    }

    return { provider: "serper", results, warnings, metadata: { total: rawItems.length } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "TIMEOUT" || msg === "ABORTED") {
      return providerError("serper", "timeout", "Serper search timed out.");
    }
    return providerError("serper", "network", `Network error contacting Serper: ${msg}`);
  }
}
