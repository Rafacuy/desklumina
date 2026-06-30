// Searxng Adapter. 
//
// points at a self-hosted searxng instance so it needs the base url env var (not an api key). 
// if the user has a private instance w/ an auth proxy, they set SEARXNG_AUTH_HEADER_NAME/VALUE and we forward it
// week range is rejected here because searxng's time_range param doesn't include it
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

export async function adaptSearxng(
  request: SearchRequest,
  timeoutMs: number,
  fetcher: typeof fetch,
): Promise<ProviderResponse | ProviderError> {
  const baseUrl = env.SEARXNG_BASE_URL;
  if (!baseUrl) {
    return providerError("searxng", "configuration", `Missing SEARXNG_BASE_URL environment variable.`, undefined);
  }

  let normalizedBase: string;
  try {
    const u = new URL(baseUrl);
    normalizedBase = `${u.protocol}//${u.host}`;
  } catch {
    return providerError("searxng", "configuration", `Invalid SEARXNG_BASE_URL: ${baseUrl}`);
  }

  if (request.timeRange === "week") {
    return providerError("searxng", "unsupported-capability", "SearXNG does not support timeRange=week.");
  }

  const url = new URL(`${normalizedBase}/search`);
  url.searchParams.set("q", request.query);
  url.searchParams.set("format", "json");
  if (request.language) url.searchParams.set("language", request.language);
  if (request.timeRange) url.searchParams.set("time_range", request.timeRange);
  if (request.type === "news") url.searchParams.set("categories", "news");
  if (request.type === "images") url.searchParams.set("categories", "images");
  url.searchParams.set("safesearch", request.safeSearch ? "1" : "0");

  const authHeaderName = env.SEARXNG_AUTH_HEADER_NAME;
  const authHeaderValue = env.SEARXNG_AUTH_HEADER_VALUE;
  const headers: Record<string, string> = {};
  if (authHeaderName && authHeaderValue) {
    headers[authHeaderName] = authHeaderValue;
  }

  const controller = new AbortController();
  try {
    const response = await withTimeout(
      fetcher(url.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      }),
      timeoutMs,
      controller.signal,
    );

    if (!response.ok) {
      const kind = classifyHttpStatus("searxng", response.status);
      return providerError("searxng", kind, `SearXNG returned HTTP ${response.status}.`, response.status);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return providerError("searxng", "malformed-response", "SearXNG did not return JSON. Ensure JSON format is enabled.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    const warnings: string[] = [];
    const results: WebSearchResultItem[] = [];
    const rawItems = Array.isArray(data.results) ? (data.results as unknown[]) : [];
    if (!Array.isArray(data.results)) {
      warnings.push("searxng: missing results array");
    }

    let rank = 0;
    for (const item of rawItems) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const link = String(raw.url ?? "");
      const normalized = normalizeUrl(link);
      if (!normalized) {
        warnings.push("searxng: dropped result with unsupported URL");
        continue;
      }
      rank++;
      results.push({
        title: String(raw.title ?? "Untitled"),
        url: normalized.url,
        snippet: String(raw.content ?? ""),
        source: sourceFromUrl(normalized.url),
        rank,
        provider: "searxng",
        providerRank: rank,
        score: typeof raw.score === "number" ? raw.score : undefined,
        publishedDate: normalizeDate(raw.published_date ?? raw.publishedDate),
        type: request.type === "news" ? "news" : request.type === "images" ? "image" : "organic",
        thumbnailUrl: raw.thumbnail ? String(raw.thumbnail) : undefined,
        metadata: { engine: raw.engine, category: raw.category },
      });
    }

    if (results.length === 0) {
      return providerError("searxng", "empty-results", "SearXNG returned no URL-bearing results.");
    }

    return {
      provider: "searxng",
      results,
      warnings,
      metadata: { total_results: data.total_results, elapsed_time: data.elapsed_time },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "TIMEOUT" || msg === "ABORTED") {
      return providerError("searxng", "timeout", "SearXNG search timed out.");
    }
    return providerError("searxng", "network", `Network error contacting SearXNG: ${msg}`);
  }
}
