import type { AiOrchestrationEvent } from "./events";
import { truncateMessage } from "./text";
import {
  AuthenticationError,
  ProviderAPIError,
  ProviderError,
  ProviderNetworkError,
  ProviderParseError,
  RateLimitError,
} from "../errors";

export interface ErrorMapContext {
  readonly providerId: string;
  readonly requestId?: string;
  readonly model?: string;
}

export function orchestrationErrorFromUnknown(error: unknown, ctx: ErrorMapContext): AiOrchestrationEvent {
  if (error instanceof RateLimitError) {
    return {
      kind: "RATE_LIMITED",
      severity: "warn",
      providerId: ctx.providerId,
      requestId: ctx.requestId,
      model: ctx.model,
      httpStatus: error.statusCode,
      retryable: error.retryable,
      detail: truncateMessage(error.message),
    };
  }
  if (error instanceof AuthenticationError) {
    return {
      kind: "ERROR",
      severity: "error",
      providerId: ctx.providerId,
      requestId: ctx.requestId,
      model: ctx.model,
      httpStatus: error.statusCode,
      retryable: false,
      detail: truncateMessage(error.message),
    };
  }
  if (error instanceof ProviderNetworkError) {
    return {
      kind: "ERROR",
      severity: "error",
      providerId: ctx.providerId,
      requestId: ctx.requestId,
      model: ctx.model,
      retryable: error.retryable,
      detail: truncateMessage(error.message),
    };
  }
  if (error instanceof ProviderParseError) {
    return {
      kind: "ERROR",
      severity: "error",
      providerId: ctx.providerId,
      requestId: ctx.requestId,
      model: ctx.model,
      httpStatus: error.statusCode,
      retryable: error.retryable,
      detail: truncateMessage(error.message),
    };
  }
  if (error instanceof ProviderAPIError) {
    return {
      kind: "ERROR",
      severity: "error",
      providerId: ctx.providerId,
      requestId: ctx.requestId,
      model: ctx.model,
      httpStatus: error.statusCode,
      retryable: error.retryable,
      detail: truncateMessage(error.message),
    };
  }
  if (error instanceof ProviderError) {
    return {
      kind: "ERROR",
      severity: "error",
      providerId: ctx.providerId,
      requestId: ctx.requestId,
      model: ctx.model,
      httpStatus: error.statusCode,
      retryable: error.retryable,
      detail: truncateMessage(error.message),
    };
  }
  const msg = error instanceof Error ? error.message : String(error);
  return {
    kind: "ERROR",
    severity: "error",
    providerId: ctx.providerId,
    requestId: ctx.requestId,
    model: ctx.model,
    detail: truncateMessage(msg),
  };
}
