import type { ToolExecutionResult } from "../../../types";
import type {
  ProviderAdapter,
  ProviderError,
  SearchProviderId,
  WebSearchOptions,
} from "./types";
import { isProviderError } from "./errors";
import { buildProviderChain, resolveTimeout } from "./provider-chain";
import { parseRequest } from "./parse-request";
import {
  buildExtra,
  buildResultText,
  capResults,
  deduplicateResults,
  truncateFields,
} from "./result-pipeline";
import { adaptSerper } from "./providers/serper";
import { adaptSerpApi } from "./providers/serpapi";
import { adaptSearxng } from "./providers/searxng";
import { adaptTavily } from "./providers/tavily";
import { sanitizeForLog } from "../../../logger/sanitize";
import { t, tf } from "../../../utils/localization/i18n";
import { logger } from "../../../logger";
import { settingsManager } from "../../../core/services/settings-manager";

// Adapter Registry. 
// add a new provider here + in PROVIDER_ORDER (provider-chain.ts)
const ADAPTERS: Record<SearchProviderId, ProviderAdapter> = {
  serper: adaptSerper,
  serpapi: adaptSerpApi,
  searxng: adaptSearxng,
  tavily: adaptTavily,
};

const QUERY_HASH_LENGTH = 8;

// tiny non-crypto hash. 
// we log it alongside the query length so we can
// correlate hits across runs without ever putting the raw query in the log
function queryHash(query: string): string {
  let h = 0;
  for (let i = 0; i < query.length; i++) {
    h = (h << 5) - h + query.charCodeAt(i);
    h |= 0;
  }
  return h.toString(16).slice(0, QUERY_HASH_LENGTH);
}

function safeQueryLabel(query: string): string {
  return `len=${query.length}`;
}

// exit codes map pretty close to the actual http statuses so the shell/regex
// can react to them. empty-results is 0 because its not really an error
const EXIT_CODES: Record<ProviderError["kind"], number> = {
  configuration: 2,
  authentication: 401,
  "rate-limit": 429,
  timeout: 124,
  network: 1,
  "malformed-response": 502,
  "empty-results": 0,
  "provider-unavailable": 503,
  "unsupported-capability": 2,
  "invalid-request": 2,
};

// Main Entry Point
// Flow: parse arg -> build chain -> walk providers w/ fallback -> format.
// w/ "auto" + fallback enabled, we keep going on retriable errors. explicit provider = no fallback
export async function webSearch(
  arg: string,
  options?: WebSearchOptions,
): Promise<ToolExecutionResult> {
  const start = Date.now();
  const fetcher = options?.fetcher ?? globalThis.fetch;
  const parsed = parseRequest(arg);
  if (parsed.error) {
    logger.warn("web-search", sanitizeForLog(`Invalid request: ${parsed.error.stderr}`));
    return parsed.error;
  }

  const request = parsed.request;
  const chain = buildProviderChain(request.provider);

  if (chain.length === 0) {
    return {
      tool: "web_search",
      result: tf("tool.result.search_failed", { reason: "No web search provider configured" }),
      success: false,
      normalizedArg: arg,
      stderr: "No web search provider configured",
      exitCode: 2,
    };
  }

  const timeoutMs = resolveTimeout();
  logger.debug(
    "web-search",
    sanitizeForLog(`search start provider=${request.provider} query=${safeQueryLabel(request.query)} hash=${queryHash(
      request.query,
    )} type=${request.type} limit=${request.limit} timeout=${timeoutMs}`),
  );

  const allWarnings: string[] = [];
  let lastError: ProviderError | null = null;

  for (const provider of chain) {
    logger.debug("web-search", `trying provider=${provider}`);
    const response = await ADAPTERS[provider](request, timeoutMs, fetcher);
    logger.debug("web-search", sanitizeForLog(`provider=${provider} responseType=${isProviderError(response) ? "error" : "success"}`));

    if (!isProviderError(response)) {
      const elapsedMs = Date.now() - start;
      const truncated = response.results.map(truncateFields);
      const deduped = deduplicateResults(truncated);
      const finalResults = capResults(deduped, request.limit, response.provider);
      const extra = buildExtra(request, { ...response, results: finalResults }, elapsedMs);
      extra.warnings = [...allWarnings, ...response.warnings].slice(0, 5);

      logger.info(
        "web-search",
        sanitizeForLog(`search complete provider=${provider} elapsed=${elapsedMs}ms results=${finalResults.length}`),
      );

      const status = finalResults.length === 0 ? "no_results" : "search_complete";
      return {
        tool: "web_search",
        result: finalResults.length === 0 ? t("tool.result.no_results") : buildResultText(finalResults, extra.warnings),
        success: finalResults.length > 0,
        normalizedArg: JSON.stringify({
          query: request.query,
          provider: request.provider,
          type: request.type,
          limit: request.limit,
        }),
        exitCode: 0,
        status,
        extra: { summary: { query: request.query, totalMatches: response.results.length, returnedMatches: finalResults.length, provider }, webSearch: extra },
      };
    }

    lastError = response;
    allWarnings.push(`${response.provider}: ${response.kind}`);
    logger.warn("web-search", sanitizeForLog(`provider=${provider} kind=${response.kind} status=${response.status ?? "none"}`));

    if (request.provider !== "auto" || !response.retriable || !settingsManager.get().webSearch?.fallbackEnabled) {
      break;
    }
  }

  const elapsedMs = Date.now() - start;
  const error = lastError!;

  logger.warn("web-search", sanitizeForLog(`search failed provider=${error.provider} kind=${error.kind} elapsed=${elapsedMs}ms`));

  if (error.kind === "empty-results") {
    return {
      tool: "web_search",
      result: t("tool.result.no_results"),
      success: true,
      normalizedArg: arg,
      exitCode: 0,
      status: "no_results",
      extra: { summary: { query: request.query, totalMatches: 0, returnedMatches: 0, provider: error.provider, warnings: allWarnings } },
    };
  }

  return {
    tool: "web_search",
    result: tf("tool.result.search_failed", { reason: `${error.provider}: ${error.message}` }),
    success: false,
    normalizedArg: arg,
    stderr: `${error.provider}: ${error.message}`,
    exitCode: EXIT_CODES[error.kind] ?? 1,
    status: error.kind,
    extra: { summary: { query: request.query, totalMatches: 0, returnedMatches: 0, provider: error.provider, warnings: allWarnings } },
  };
}
