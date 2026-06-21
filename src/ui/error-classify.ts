/**
 * Error taxonomy + raw-string handling for the Rofi error UI.
 *
 * Single source of truth for `ui-error-spec.md` §Error Taxonomy and
 * §Error → Content Mapping. The classifier is a pure function so it can
 * be unit-tested without a running Rofi/AI stack.
 */

import {
  AuthenticationError,
  RateLimitError,
  ProviderAPIError,
  ProviderError,
  ProviderNetworkError,
} from "../ai/errors";

/**
 * The seven categories defined by the spec. Order in the union is purely
 * cosmetic — runtime priority lives inside `classifyError`.
 */
export type ErrorCategory =
  | "network"
  | "provider"
  | "model"
  | "auth"
  | "ratelimit"
  | "timeout"
  | "unknown";

/**
 * i18n key mapping per `ui-error-spec.md` §Error → Content Mapping.
 * Titles and suggestions are localized at render time via `t()`.
 */
export const CATEGORY_I18N_KEYS: Record<
  ErrorCategory,
  { title: string; suggestion: string }
> = {
  network: { title: "error.network.title", suggestion: "error.network.suggestion" },
  provider: { title: "error.provider.title", suggestion: "error.provider.suggestion" },
  model: { title: "error.model.title", suggestion: "error.model.suggestion" },
  auth: { title: "error.auth.title", suggestion: "error.auth.suggestion" },
  ratelimit: { title: "error.ratelimit.title", suggestion: "error.ratelimit.suggestion" },
  timeout: { title: "error.timeout.title", suggestion: "error.timeout.suggestion" },
  unknown: { title: "error.unknown.title", suggestion: "error.unknown.suggestion" },
};

const RAW_PREVIEW_MAX = 60;
const RAW_PREVIEW_ELLIPSIS = "···";

const NETWORK_PATTERN =
  /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|ENETUNREACH|EHOSTUNREACH|getaddrinfo|fetch failed|network request failed/i;
const TIMEOUT_PATTERN = /timeout|timed out|deadline exceeded|ETIMEDOUT/i;
const MODEL_NOT_FOUND_PATTERN =
  /model_not_found|model not found|does not exist|is not available|unsupported model|unknown model/i;

interface ProviderLike {
  statusCode?: number;
  rawPayload?: string;
}

function providerInfo(error: unknown): ProviderLike {
  if (error instanceof ProviderError) {
    return { statusCode: error.statusCode, rawPayload: error.rawPayload };
  }
  return {};
}

function statusOf(error: unknown): number | undefined {
  return providerInfo(error).statusCode;
}

function textualBody(error: unknown): string {
  const { rawPayload } = providerInfo(error);
  const message = error instanceof Error ? error.message : String(error);
  return rawPayload ? `${message}\n${rawPayload}` : message;
}

/**
 * Classify an arbitrary thrown value into one of the seven spec categories.
 *
 * The check order matters: more specific signal classes (auth / ratelimit)
 * are inspected before coarser heuristics (network / timeout / provider).
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof AuthenticationError) return "auth";
  if (error instanceof RateLimitError) return "ratelimit";

  const status = statusOf(error);
  const body = textualBody(error);
  const lowerBody = body.toLowerCase();

  if (status === 404 || (status === 400 && MODEL_NOT_FOUND_PATTERN.test(body))) {
    return "model";
  }

  if (error instanceof ProviderNetworkError) return "network";
  if (status === 408) return "timeout";

  if (NETWORK_PATTERN.test(body)) return "network";

  if (
    (error instanceof Error && TIMEOUT_PATTERN.test(error.message)) ||
    (error instanceof Error && /^(AbortError|TimeoutError)$/.test(error.name))
  ) {
    return "timeout";
  }

  if (
    (error instanceof ProviderAPIError || error instanceof ProviderError) &&
    typeof status === "number" &&
    status >= 500 &&
    status <= 599
  ) {
    return "provider";
  }
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return "provider";
  }

  if (lowerBody.includes("rate limit") || lowerBody.includes("quota")) {
    return "ratelimit";
  }

  return "unknown";
}

/**
 * Build the full, unmodified raw error string used by the Copy action.
 *
 * The displayed panel shows only a truncated preview; this function returns
 * the *complete* value that gets piped to the clipboard. It is never passed
 * through `t()`/`tf()` — provider/system strings are surfaced verbatim.
 *
 * Preference order: sanitized `rawPayload` (richest) → `error.message` →
 * `String(error)`. `AllModelsFailedError` carries an attempted-models list
 * which is appended for debugging context.
 */
export function buildRawErrorString(error: unknown): string {
  if (error instanceof ProviderError) {
    const parts: string[] = [];
    if (error.rawPayload) {
      parts.push(error.rawPayload.trim());
    }
    parts.push(error.message);
    if (typeof error.statusCode === "number") {
      parts.push(`(HTTP ${error.statusCode})`);
    }
    const attempted = attemptedModelsOf(error);
    if (attempted) {
      parts.push(`[attempted: ${attempted.join(", ")}]`);
    }
    return parts.filter(Boolean).join(" ");
  }

  const attempted = attemptedModelsOf(error);
  const base = error instanceof Error ? error.message : String(error);
  return attempted ? `${base} [attempted: ${attempted.join(", ")}]` : base;
}

function attemptedModelsOf(error: unknown): string[] | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "attemptedModels" in error
  ) {
    const attempted = (error as { attemptedModels: unknown }).attemptedModels;
    if (Array.isArray(attempted) && attempted.length > 0) {
      return attempted.filter((m): m is string => typeof m === "string");
    }
  }
  return undefined;
}

/**
 * Truncate a raw error string to a ~60-char preview with trailing `···`.
 *
 * Unicode-safe: counts code points, not UTF-16 units, so emoji or combining
 * marks don't get sliced mid-cluster. The original string is preserved by
 * the caller — this only produces the *displayed* preview.
 */
export function truncateRawPreview(raw: string): string {
  const chars = Array.from(raw);
  if (chars.length <= RAW_PREVIEW_MAX) return raw;
  return chars.slice(0, RAW_PREVIEW_MAX).join("") + RAW_PREVIEW_ELLIPSIS;
}
