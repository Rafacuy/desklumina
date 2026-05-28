import { dispatch } from "../tools";
import { logger } from "../logger";
import { t } from "../utils";
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
