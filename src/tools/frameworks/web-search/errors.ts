import type {
  ProviderError,
  ProviderResponse,
  SearchProviderId,
} from "./types";

// which error kinds the orchestrator is allowed to fallback on.
// auth/config issues = your fault, dont retry. network/timeout/etc = try next
export function isRetriable(kind: ProviderError["kind"]): boolean {
  return ["timeout", "network", "rate-limit", "provider-unavailable", "malformed-response"].includes(kind);
}

export function classifyHttpStatus(
  provider: SearchProviderId,
  status: number,
): ProviderError["kind"] {
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "provider-unavailable";
  if (status >= 400 && status < 500) return "invalid-request";
  return "provider-unavailable";
}

export function providerError(
  provider: SearchProviderId,
  kind: ProviderError["kind"],
  message: string,
  status?: number,
): ProviderError {
  return { provider, kind, message, status, retriable: isRetriable(kind) };
}

// duck-typed discriminant. 
// both ProviderError and ProviderResponse are returned
// from adapters, so we sniff `kind` to tell them apart. 
//
// NOTE: do NOT add `kind` to
// ProviderResponse or this whole thing breaks
export function isProviderError(
  response: ProviderResponse | ProviderError,
): response is ProviderError {
  return (response as ProviderError).kind !== undefined;
}
