import {
  AuthenticationError,
  ProviderAPIError,
  RateLimitError,
} from "../errors";

export interface ErrorNormalizationOptions {
  provider: string;
  response: Response;
  defaultMessage?: string;
  isRetryable?: (status: number, parsed: unknown) => boolean;
}

export async function normalizeProviderError({
  provider,
  response,
  defaultMessage,
  isRetryable,
}: ErrorNormalizationOptions): Promise<Error> {
  const rawPayload = await response.text();
  let message = defaultMessage ?? `${provider} API error ${response.status}`;
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawPayload);
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const errorObj = (parsed as { error: unknown }).error;
      if (errorObj && typeof errorObj === "object" && "message" in errorObj && typeof errorObj.message === "string") {
        message = errorObj.message;
      }
    }
  } catch {
    // Ignore parse error for error payload
  }

  const options = {
    provider,
    message,
    statusCode: response.status,
    rawPayload,
  };

  if (response.status === 401 || response.status === 403) {
    return new AuthenticationError(options);
  }
  if (response.status === 429) {
    return new RateLimitError(options);
  }

  let retryable = response.status >= 500 || response.status === 408;
  if (isRetryable && parsed) {
    retryable = retryable || isRetryable(response.status, parsed);
  }

  return new ProviderAPIError({
    ...options,
    retryable,
  });
}
