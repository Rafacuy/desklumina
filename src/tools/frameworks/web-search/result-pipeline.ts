import type { WebSearchExtraData, WebSearchResultItem } from "../../../types";
import type { ProviderResponse, SearchRequest } from "./types";
import { truncate, normalizeText, stripHtmlTags } from "../../../utils/formatting/format";
import { canonicalUrlKey } from "../../../utils/url";
import { t } from "../../../utils/localization/i18n";

const MAX_TITLE_LENGTH = 140;
const MAX_SNIPPET_LENGTH = 320;
const MAX_RAW_CONTENT_PREVIEW = 500;
const MAX_METADATA_CHARS = 1024;

// trims long fields so one weird result cant blow up the context budget.
// also strips html cuz half the providers return tag soup
export function truncateFields(result: WebSearchResultItem): WebSearchResultItem {
  const truncated = { ...result };
  truncated.title = truncate(normalizeText(stripHtmlTags(result.title)), MAX_TITLE_LENGTH);
  let snippet = normalizeText(stripHtmlTags(result.snippet));
  if (result.rawContentPreview) {
    const raw = stripHtmlTags(normalizeText(result.rawContentPreview));
    truncated.rawContentPreview = truncate(raw, MAX_RAW_CONTENT_PREVIEW);
  }
  if (snippet.length > MAX_SNIPPET_LENGTH) {
    snippet = truncate(snippet, MAX_SNIPPET_LENGTH);
    truncated.metadata = { ...truncated.metadata, truncated: true };
  }
  truncated.snippet = snippet;
  return truncated;
}

// 2-pass dedup: exact url match first, then "near" duplicates (same source +
// title + first 120 chars of snippet). the second pass catches syndication
// where 2+ sites copy the same article word-for-word
export function deduplicateResults(results: WebSearchResultItem[]): WebSearchResultItem[] {
  const seen = new Map<string, WebSearchResultItem>();
  const nearDuplicateSeen = new Set<string>();
  for (const result of results) {
    const key = canonicalUrlKey(result.url);
    if (seen.has(key)) continue;

    const snippetPrefix = result.snippet.slice(0, 120).toLowerCase();
    const nearKey = `${result.source.toLowerCase()}|${result.title.toLowerCase()}|${snippetPrefix}`;
    if (nearDuplicateSeen.has(nearKey)) continue;

    seen.set(key, result);
    nearDuplicateSeen.add(nearKey);
  }
  return Array.from(seen.values());
}

const PROVIDER_RESULT_CAPS: Record<string, number> = {
  tavily: 20,
  serper: 10,
  serpapi: 10,
  searxng: 10,
};

export function capResults(results: WebSearchResultItem[], limit: number, provider?: string): WebSearchResultItem[] {
  const cap = provider && provider in PROVIDER_RESULT_CAPS ? PROVIDER_RESULT_CAPS[provider]! : 10;
  const max = Math.max(1, Math.min(cap, limit));
  return results.slice(0, max);
}

export function buildResultText(results: WebSearchResultItem[], warnings: string[]): string {
  if (results.length === 0) return t("tool.result.no_results");
  const lines = results.map((r, i) => {
    const date = r.publishedDate ? ` · ${r.publishedDate}` : "";
    return `${i + 1}. ${r.title}${date}\n   ${r.url}\n   ${r.snippet}`;
  });
  if (warnings.length > 0) {
    lines.push("", warnings.join("; "));
  }
  return lines.join("\n");
}

export function buildExtra(
  request: SearchRequest,
  response: ProviderResponse,
  elapsedMs: number,
): WebSearchExtraData {
  const extra: WebSearchExtraData = {
    provider: response.provider,
    query: request.query,
    type: request.type,
    requestedLimit: request.limit,
    returnedCount: response.results.length,
    elapsedMs,
    warnings: response.warnings,
    results: response.results,
  };
  if (response.requestId) extra.requestId = response.requestId;
  if (response.answer) extra.providerAnswer = { provider: response.provider, ...response.answer };
  if (response.metadata) {
    const serialized = JSON.stringify(response.metadata);
    extra.metadata = serialized.length > MAX_METADATA_CHARS ? { truncated: true } : response.metadata;
  }
  return extra;
}
