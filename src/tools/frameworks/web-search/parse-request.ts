import type { ToolExecutionResult } from "../../../types";
import type { SearchRequest, SearchType, TimeRange } from "./types";
import { resolveProviderPreference } from "./provider-chain";
import { normalizeText } from "../../../utils/formatting/format";
import { t, tf } from "../../../utils/localization/i18n";
import { settingsManager } from "../../../core/services/settings-manager";

// ppl have tried pasting novels as queries. 
// cap it before we burn tokens on a doomed search
const MAX_QUERY_LENGTH = 500;

// parses the raw tool arg (json string from the LLM) into a clean SearchRequest
// or returns a tool error if the LLM sent garbage. all validation lives here
// so the orchestrator can assume the request is sane
export function parseRequest(
  raw: string,
): { request: SearchRequest; error?: ToolExecutionResult } {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: t("tool.result.invalid_request"),
        success: false,
        normalizedArg: raw,
        stderr: "Arguments must be a valid JSON object string",
        exitCode: 2,
      },
    };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: t("tool.result.invalid_request"),
        success: false,
        normalizedArg: raw,
        stderr: "Malformed JSON argument",
        exitCode: 2,
      },
    };
  }

  const query = normalizeText(String(parsed.query ?? ""));
  if (!query) {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: t("tool.result.invalid_request"),
        success: false,
        normalizedArg: raw,
        stderr: "Missing or empty query",
        exitCode: 2,
      },
    };
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: tf("tool.result.search_failed", { reason: `Query exceeds ${MAX_QUERY_LENGTH} characters` }),
        success: false,
        normalizedArg: raw,
        stderr: `Query exceeds ${MAX_QUERY_LENGTH} characters`,
        exitCode: 2,
      },
    };
  }

  const requestedProvider = String(parsed.provider ?? "auto");
  if (!["auto", "serper", "serpapi", "searxng", "tavily"].includes(requestedProvider)) {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: tf("tool.result.search_failed", { reason: `Unsupported provider: ${requestedProvider}` }),
        success: false,
        normalizedArg: raw,
        stderr: `Unsupported provider: ${requestedProvider}`,
        exitCode: 2,
      },
    };
  }

  const requestedType = String(parsed.type ?? "web");
  if (!["web", "news", "images"].includes(requestedType)) {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: tf("tool.result.search_failed", { reason: `Unsupported type: ${requestedType}` }),
        success: false,
        normalizedArg: raw,
        stderr: `Unsupported type: ${requestedType}`,
        exitCode: 2,
      },
    };
  }

  const timeRange = parsed.timeRange ? String(parsed.timeRange) : undefined;
  if (timeRange && !["day", "week", "month", "year"].includes(timeRange)) {
    return {
      request: undefined as unknown as SearchRequest,
      error: {
        tool: "web_search",
        result: tf("tool.result.search_failed", { reason: `Unsupported timeRange: ${timeRange}` }),
        success: false,
        normalizedArg: raw,
        stderr: `Unsupported timeRange: ${timeRange}`,
        exitCode: 2,
      },
    };
  }

  const provider = resolveProviderPreference(requestedProvider);
  const providerLimitMax = provider === "tavily" ? 20 : 10;
  let limit = Number(parsed.limit ?? settingsManager.get().webSearch?.defaultLimit ?? 5);
  if (!Number.isFinite(limit)) limit = 5;
  limit = Math.max(1, Math.min(providerLimitMax, Math.round(limit)));

  const settings = settingsManager.get().webSearch ?? {};
  const request: SearchRequest = {
    query,
    provider,
    type: requestedType as SearchType,
    limit,
    language: parsed.language ? String(parsed.language) : (settings.language || undefined),
    country: parsed.country ? String(parsed.country) : (settings.country || undefined),
    timeRange: timeRange as TimeRange | undefined,
    includeRawContent: Boolean(parsed.includeRawContent ?? settings.includeRawContent ?? false),
    includeImages: Boolean(parsed.includeImages ?? false) || requestedType === "images",
    safeSearch: Boolean(settings.safeSearch ?? false),
  };

  return { request };
}
