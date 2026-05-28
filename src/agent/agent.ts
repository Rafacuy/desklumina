import { logger } from "../logger";
import { streamAI } from "../ai";
import { parseToolCalls } from "../core/planner";
import { SAFE_TOKEN_LIMIT } from "../constants";
import { detectTerminalSignal, stripMarkers } from "./signals";
import { formatToolResults, trimHistory, estimateHistoryTokens } from "./context";
import { executeToolCalls } from "./executor";
import { synthesizeWithHistory, SYNTHESIS_PROMPT } from "./synthesis";
import type { AgentContext, AgentRunOptions, AgentResult } from "./types";
import type { AIMessage } from "../types";

const DEFAULT_MAX_TURNS = 10;

function stripToolCalls(text: string): string {
  let result = text;
  
  const codeBlockRegex = /```(?:json|JSON)?\s*([\s\S]*?)\s*```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (!match[1]) continue;
    try {
      const parsed = JSON.parse(match[1]);
      const isToolCheck = Array.isArray(parsed) 
        ? parsed.some((p: any) => p && typeof p === "object" && "tool" in p && "args" in p) 
        : (parsed && typeof parsed === "object" && "tool" in parsed && "args" in parsed);
      if (isToolCheck) {
        result = result.replace(match[0], "");
      }
    } catch {}
  }
  
  const rawCandidateRegex = /\{(?:[^{}]|\{[^{}]*\})*\}/g;
  while ((match = rawCandidateRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === "object" && "tool" in parsed && "args" in parsed) {
        result = result.replace(match[0], "");
      }
    } catch {}
  }
  
  return result.trim();
}

export async function runAgent(
  baseMessages: AIMessage[],
  options?: AgentRunOptions
): Promise<AgentResult> {
  const maxTurns = options?.maxTurns ?? DEFAULT_MAX_TURNS;
  const onEvent = options?.onEvent;

  const history = [...baseMessages];

  const ctx: AgentContext = {
    history,
    turn: 0,
    status: "running",
  };

  const allToolResults: import("../types").ToolResult[] = [];

  if (estimateHistoryTokens(ctx.history) > SAFE_TOKEN_LIMIT) {
    ctx.history = trimHistory(ctx.history);
  }

  while (ctx.turn < maxTurns && ctx.status === "running") {
    ctx.turn++;

    if (estimateHistoryTokens(ctx.history) > SAFE_TOKEN_LIMIT) {
      ctx.history = trimHistory(ctx.history);
    }

    let assistantOutput = "";
    for await (const chunk of streamAI(ctx.history)) {
      assistantOutput += chunk;
      onEvent?.({ type: "content", content: chunk });
    }

    if (!assistantOutput) {
      logger.warn("agent", `Empty response from streamAI on turn ${ctx.turn}`);
      ctx.status = "failed";
      return { finalResponse: "Task failed: Model returned an empty response.", allToolResults, history: ctx.history, terminalSignal: { type: "FAIL", reason: "Model returned an empty response." } };
    }

    ctx.history.push({ role: "assistant", content: assistantOutput });

    const signal = detectTerminalSignal(assistantOutput);
    const calls = parseToolCalls(assistantOutput);

    if (calls.length === 0) {
      if (signal.type === "DONE") {
        ctx.status = "complete";
        if (allToolResults.length === 0) {
          logger.warn("agent", "Model emitted [[DONE]] with 0 tool results on first turn (hallucinated completion?)");
        }
        return { finalResponse: stripMarkers(assistantOutput).trim(), allToolResults, history: ctx.history, terminalSignal: signal };
      }

      if (signal.type === "FAIL") {
        ctx.status = "failed";
        return { finalResponse: stripMarkers(assistantOutput).trim(), allToolResults, history: ctx.history, terminalSignal: signal };
      }

      ctx.status = "complete";
      return { finalResponse: stripMarkers(assistantOutput).trim(), allToolResults, history: ctx.history, terminalSignal: signal };
    }

    if (signal.type !== "NONE") {
      logger.warn("agent", `Model emitted signal ${signal.type} alongside tool calls. Executing tools and granting one final turn.`);
    }

    if (signal.type === "DONE" && allToolResults.length === 0) {
      logger.warn("agent", "Model emitted [[DONE]] with tool calls but 0 prior tool results (hallucinated completion?)");
    }

    onEvent?.({ type: "tool_pending", tools: calls });

    const results = await executeToolCalls(calls, (retryResult, attempt) => {
      onEvent?.({ type: "tool_retry", attempt, tool: retryResult.tool, error: retryResult.stderr || retryResult.result || "Unknown error" });
    });

    allToolResults.push(...results);

    onEvent?.({ type: "tool_results", results });

    ctx.history.push({
      role: "user",
      content: formatToolResults(results),
    });

    if (estimateHistoryTokens(ctx.history) > SAFE_TOKEN_LIMIT) {
      ctx.history = trimHistory(ctx.history);
    }
  }

  if (ctx.status === "running") {
    const synthMock: AIMessage = { role: "user", content: SYNTHESIS_PROMPT };
    if (estimateHistoryTokens([...ctx.history, synthMock]) > SAFE_TOKEN_LIMIT) {
      ctx.history = trimHistory(ctx.history);
    }

    let synthesisOutput = "";
    for await (const chunk of synthesizeWithHistory(ctx.history)) {
      synthesisOutput += chunk;
      onEvent?.({ type: "content", content: chunk });
    }

    if (!synthesisOutput) {
      logger.warn("agent", "Empty response from synthesis fallback");
      return { finalResponse: "Task failed: Model returned an empty response during synthesis.", allToolResults, history: ctx.history, terminalSignal: { type: "FAIL", reason: "Model returned an empty response during synthesis." } };
    }

    const synthCalls = parseToolCalls(synthesisOutput);
    if (synthCalls.length > 0) {
      logger.warn("agent", "Model emitted tool calls during synthesis fallback. They will be ignored.");
      synthesisOutput = stripToolCalls(synthesisOutput);
    }

    ctx.history.push({ role: "assistant", content: synthesisOutput });

    const synthSignal = detectTerminalSignal(synthesisOutput);
    return { finalResponse: stripMarkers(synthesisOutput).trim(), allToolResults, history: ctx.history, terminalSignal: synthSignal.type !== "NONE" ? synthSignal : undefined };
  }

  return { finalResponse: "", allToolResults, history: ctx.history };
}