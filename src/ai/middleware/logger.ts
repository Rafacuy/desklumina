import { emitOrchestrationLog } from "../observability/emit";
import { SAFE_TOKEN_LIMIT } from "../../constants";
import type { MiddlewareContext, MiddlewareHandler } from "./types";

export function createLoggerMiddleware(): MiddlewareHandler {
  return async function* (ctx: MiddlewareContext, next) {
    const estimatedInputTokens = ctx.metrics.estimatedInputTokens;

    emitOrchestrationLog({
      kind: "DEBUG",
      severity: "debug",
      providerId: ctx.providerId,
      model: ctx.model,
      requestId: ctx.requestId,
      detail: `est_input_tokens=${estimatedInputTokens} limit=${SAFE_TOKEN_LIMIT}`,
    });

    if (estimatedInputTokens > SAFE_TOKEN_LIMIT) {
      emitOrchestrationLog({
        kind: "DEBUG",
        severity: "warn",
        providerId: ctx.providerId,
        model: ctx.model,
        requestId: ctx.requestId,
        detail: "input exceeds safe token estimate",
      });
    }

    yield* next();
  };
}
