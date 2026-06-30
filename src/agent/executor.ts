import { dispatch } from "../tools";
import { logger } from "../logger";
import { t } from "../utils";
import { resultStore } from "../tools/result-store";
import { getDispatchMode } from "../tools/registry/modes";
import type { ParsedToolCall, ToolResult } from "../types";
import { CancellationError } from "../types";

export const MAX_TOOL_RETRIES = 2;
const RETRY_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createErrorResult(call: ParsedToolCall, errMsg: string, attempt: number): ToolResult {
  return {
    tool: call.tool,
    result: `${t("common.error")}: ${errMsg}`,
    success: false,
    normalizedArg: call.arg.trim(),
    stderr: errMsg,
    exitCode: 1,
    attempt,
  };
}

export async function executeToolCalls(
  calls: ParsedToolCall[],
  onRetry?: (result: ToolResult, attempt: number) => void
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const call of calls) {
    const mode = getDispatchMode(call.tool, call.arg);

    if (mode === "non-blocking") {
      const operationId = Bun.randomUUIDv7();

      resultStore.registerPending({
        id: operationId,
        tool: call.tool,
        arg: call.arg,
        startedAt: Date.now(),
        status: "pending",
      });

      dispatch(call.tool, call.arg)
        .then((output) => {
          resultStore.complete(operationId, {
            ...output,
            attempt: 0,
          });
        })
        .catch((error) => {
          resultStore.complete(operationId, {
            tool: call.tool,
            result: `Error: ${error instanceof Error ? error.message : String(error)}`,
            success: false,
            normalizedArg: call.arg.trim(),
            stderr: error instanceof Error ? error.message : String(error),
            exitCode: 1,
            attempt: 0,
          });
        });

      results.push({
        tool: call.tool,
        result: "Operation dispatched. Running in background. Result will be available on your next response.",
        success: true,
        normalizedArg: call.arg.trim(),
        exitCode: 0,
        dispatched: true,
        operationId,
      });
    } else {
      let result: ToolResult = createErrorResult(call, "Tool execution did not complete", -1);
      let attempts = 0;

      while (attempts <= MAX_TOOL_RETRIES) {
        try {
          logger.info("executor", `Tool attempt ${attempts}: ${call.tool} ${call.arg}`);
          const output = await dispatch(call.tool, call.arg);
          logger.info("executor", `Tool attempt ${attempts} result: ${call.tool} success=${output.success}`);

          result = { ...output, attempt: attempts };
          break;
        } catch (error) {
          if (error instanceof CancellationError) {
            throw error;
          }

          attempts++;
          const retriable = isRetriableToolError(error);
          const errMsg = logger.catchError(`tool:${call.tool}`, error);

          result = createErrorResult(call, errMsg, attempts - 1);

          if (!retriable || attempts > MAX_TOOL_RETRIES) {
            break;
          }

          if (onRetry) {
            onRetry(result, attempts);
          }

          await sleep(RETRY_DELAY_MS * attempts);
        }
      }

      results.push(result);
    }
  }

  return results;
}

export function isRetriableToolError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes("timeout")) return true;
  if (msg.includes("econnreset")) return true;
  if (msg.includes("etimedout")) return true;
  if (msg.includes("enotready")) return true;
  if (msg.includes("eagain")) return true;
  return false;
}
