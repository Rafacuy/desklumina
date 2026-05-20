export type OrchestrationKind =
  | "START"
  | "STREAM"
  | "OK"
  | "RETRY"
  | "ERROR"
  | "ABORT"
  | "RATE_LIMITED"
  | "DEBUG";

export type OrchestrationSeverity = "debug" | "info" | "warn" | "error";

export interface AiOrchestrationEvent {
  readonly kind: OrchestrationKind;
  readonly severity: OrchestrationSeverity;
  readonly providerId: string;
  readonly requestId?: string;
  readonly model?: string;
  readonly detail?: string;
  readonly httpStatus?: number;
  readonly retryable?: boolean;
  readonly durationMs?: number;
  readonly tokensPerSec?: number;
  readonly streamState?: "warming" | "active";
  readonly elapsedMs?: number;
  readonly chunkCount?: number;
  readonly outputChars?: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly fromModel?: string;
  readonly toModel?: string;
  readonly fallbackIndex?: number;
  readonly legacyMessage?: string;
}
