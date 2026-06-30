// Tavily Adapter. 
//
// gives us a `topic` enum (general/news) + an optional `answer` summary block. 
// we surface the answer via ProviderResponse.answer
// and let the orchestrator decide what to do with it
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

export async function adaptTavily(
  request: SearchRequest,
  timeoutMs: number,
  fetcher: typeof fetch,
): Promise<ProviderResponse | ProviderError> {
  const apiKey = env.TAVILY_API_KEY;
  if (!apiKey) {
    return providerError("tavily", "configuration", `Missing TAVILY_API_KEY environment variable.`, undefined);
  }

  const warnings: string[] = [];
  const body: Record<string, unknown> = {
    query: request.query,
    search_depth: "basic",
    include_answer: false,
    include_raw_content: request.includeRawContent,
    max_results: Math.max(0, Math.min(20, request.limit || 5)),
  };

  let topic: "general" | "news" | "finance" = "general";
  if (request.type === "news") topic = "news";
  if (request.type === "images") {
    topic = "general";
    body.include_images = true;
  }
  body.topic = topic;

  if (request.country) {
    if (topic === "general") {
      body.country = request.country;
    } else {
      warnings.push("tavily: country ignored for non-general topic");
    }
  }

  const controller = new AbortController();
  try {
    const response = await withTimeout(
      fetcher("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }),
      timeoutMs,
      controller.signal,
    );

    if (!response.ok) {
      const kind = classifyHttpStatus("tavily", response.status);
      return providerError("tavily", kind, `Tavily returned HTTP ${response.status}.`, response.status);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const results: WebSearchResultItem[] = [];
    const rawItems = Array.isArray(data.results) ? (data.results as unknown[]) : [];
    if (!Array.isArray(data.results)) {
      warnings.push("tavily: missing results array");
    }

    let rank = 0;
    for (const item of rawItems) {
      if (!item || typeof item !== "object") continue;
      const raw = item as Record<string, unknown>;
      const link = String(raw.url ?? "");
      const normalized = normalizeUrl(link);
      if (!normalized) {
        warnings.push("tavily: dropped result with unsupported URL");
        continue;
      }
      rank++;
      const content = String(raw.content ?? "");
      results.push({
        title: String(raw.title ?? "Untitled"),
        url: normalized.url,
        snippet: content,
        source: sourceFromUrl(normalized.url),
        rank,
        provider: "tavily",
        providerRank: rank,
        score: typeof raw.score === "number" ? raw.score : undefined,
        publishedDate: normalizeDate(raw.published_date),
        type: request.type === "news" ? "news" : request.type === "images" ? "image" : "organic",
        thumbnailUrl: raw.images && Array.isArray(raw.images) ? String(raw.images[0] ?? "") : undefined,
        rawContentPreview: request.includeRawContent ? String(raw.raw_content ?? content) : undefined,
        metadata: { favicon: raw.favicon },
      });
    }

    if (results.length === 0) {
      return providerError("tavily", "empty-results", "Tavily returned no URL-bearing results.");
    }

    const metadata: Record<string, unknown> = { response_time: data.response_time };
    if (data.request_id) metadata.requestId = data.request_id;
    if (data.usage && typeof data.usage === "object") {
      const usage = data.usage as Record<string, unknown>;
      metadata.usage = { tokens: usage.tokens, credits: usage.credits };
    }

    const answer = data.answer
      ? { text: String(data.answer), attributed: false }
      : undefined;

    return { provider: "tavily", results, warnings, answer, metadata };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "TIMEOUT" || msg === "ABORTED") {
      return providerError("tavily", "timeout", "Tavily search timed out.");
    }
    return providerError("tavily", "network", `Network error contacting Tavily: ${msg}`);
  }
}
