export interface ProviderErrorOptions {
  provider: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
  rawPayload?: string;
  cause?: unknown;
}

function sanitizePayload(payload: string | undefined): string | undefined {
  if (!payload) return undefined;
  return payload
    .replace(/Authorization\s*:\s*Bearer\s+[^\s"'}]+/gi, "Authorization: Bearer [REDACTED]")
    .replace(/Bearer\s+(gsk_|sk-)[A-Za-z0-9_-]+/g, "Bearer [REDACTED]")
    .slice(0, 4000);
}

export class ProviderError extends Error {
  readonly provider: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly rawPayload?: string;
  override readonly cause?: unknown;

  constructor(options: ProviderErrorOptions) {
    super(options.message);
    this.name = "ProviderError";
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.rawPayload = sanitizePayload(options.rawPayload);
    this.cause = options.cause;
  }
}

export class AuthenticationError extends ProviderError {
  constructor(options: Omit<ProviderErrorOptions, "retryable">) {
    super({ ...options, retryable: false });
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends ProviderError {
  constructor(options: Omit<ProviderErrorOptions, "retryable"> & { retryable?: boolean }) {
    super({ ...options, retryable: options.retryable ?? true });
    this.name = "RateLimitError";
  }
}

export class ProviderAPIError extends ProviderError {
  constructor(options: ProviderErrorOptions) {
    super(options);
    this.name = "ProviderAPIError";
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(options: Omit<ProviderErrorOptions, "statusCode" | "retryable"> & { retryable?: boolean }) {
    super({ ...options, retryable: options.retryable ?? true });
    this.name = "ProviderNetworkError";
  }
}

export class ProviderParseError extends ProviderError {
  constructor(options: Omit<ProviderErrorOptions, "retryable"> & { retryable?: boolean }) {
    super({ ...options, retryable: options.retryable ?? false });
    this.name = "ProviderParseError";
  }
}

