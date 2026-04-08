import { t } from "../utils";
import { streamGroq, textToSpeech } from "../ai";
import { buildSystemPrompt } from "../ai/prompts";
import { Context } from "./context";
import { ChatManager } from "./chat-manager";
import { parseToolCalls } from "./planner";
import { dispatch } from "../tools";
import { logger } from "../logger";
import { ToolDisplay } from "../ui/tool-display";
import { settingsManager } from "./settings-manager";
import { CancellationError } from "../types";
import type { AIMessage, ToolCall, ToolExecutionResult, ToolResult } from "../types";

const MAX_TOOL_RETRIES = 2;

function cleanAssistantResponse(response: string): string {
  return response
    .replace(/```json\s*\n[\s\S]*?\n```/g, "")
    .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
    .trim();
}

function formatToolResultForContext(result: ToolResult): string {
  const lines = [
    `[TOOL RESULT] tool=${result.tool}`,
    `status=${result.success === false ? "failed" : "ok"}`,
    result.normalizedArg ? `args=${result.normalizedArg}` : "",
    result.command ? `command=${result.command}` : "",
    result.exitCode !== undefined ? `exit_code=${result.exitCode}` : "",
    result.stdout ? `stdout=${result.stdout.trim()}` : "",
    result.stderr ? `stderr=${result.stderr.trim()}` : "",
    `message=${result.result.trim()}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildRetryMessages(
  baseMessages: AIMessage[],
  originalUserMessage: string,
  previousAssistantResponse: string,
  failedResults: ToolResult[]
): AIMessage[] {
  const retryFeedback = failedResults.map(formatToolResultForContext).join("\n\n");

  return [
    ...baseMessages,
    { role: "assistant", content: previousAssistantResponse },
    {
      role: "system",
      content: [
        "One or more tool calls failed.",
        `Original user request: ${originalUserMessage}`,
        "Correct the failed tool invocation only.",
        "Reply with a short acknowledgement and a JSON markdown block.",
        "Use strict tool arguments. Do not repeat failed arguments if the feedback shows why they failed.",
        retryFeedback,
      ].join("\n\n"),
    },
  ];
}

async function collectStream(messages: AIMessage[], onChunk?: (chunk: string) => void): Promise<string> {
  let response = "";
  for await (const chunk of streamGroq(messages)) {
    response += chunk;
    onChunk?.(chunk);
  }
  return response;
}

function toToolResults(results: ToolExecutionResult[], attempt: number): ToolResult[] {
  return results.map((result) => ({
    ...result,
    attempt,
  }));
}

export class Lumina {
  private context = new Context();
  private chatManager: ChatManager | undefined;

  constructor(chatManager?: ChatManager) {
    this.chatManager = chatManager;
  }

  async chat(
    userMessage: string,
    onChunk?: (chunk: string, toolOutput?: string) => void
  ): Promise<string> {
    logger.info("lumina", `User: ${userMessage}`);

    const systemPrompt = await buildSystemPrompt();
    const contextState = this.chatManager
      ? this.chatManager.getMessagesForAPI()
      : { messages: this.context.getMessages() };

    const baseMessages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...contextState.messages,
      { role: "user", content: userMessage },
    ];

    if (this.chatManager) {
      this.chatManager.addMessage(userMessage, "user");
    }

    let fullResponse = "";
    const settings = settingsManager.get();

    try {
      fullResponse = await collectStream(baseMessages, (chunk) => onChunk?.(chunk));
      logger.info("lumina", `Assistant: ${fullResponse.substring(0, 100)}...`);

      const initialToolCalls = parseToolCalls(fullResponse);
      const cleanResponse = cleanAssistantResponse(fullResponse);

      if (this.chatManager) {
        this.chatManager.addMessage(cleanResponse, "assistant", initialToolCalls);
      } else {
        this.context.add("user", userMessage);
        this.context.add("assistant", cleanResponse || fullResponse);
      }

      if (settings.features.tts) {
        logger.debug("lumina", t("TTS enabled, triggering text-to-speech"));
        textToSpeech(fullResponse).catch((err) => {
          logger.error("lumina", t("TTS failed"), err instanceof Error ? err : new Error(String(err)));
        });
      }

      if (initialToolCalls.length === 0) {
        return fullResponse;
      }

      logger.info("lumina", `Executing ${initialToolCalls.length} tool call(s)`);
      const allToolResults: ToolResult[] = [];
      let pendingToolCalls: ToolCall[] = initialToolCalls;
      let retrySourceResponse = fullResponse;

      for (let attempt = 0; attempt <= MAX_TOOL_RETRIES && pendingToolCalls.length > 0; attempt++) {
        const attemptNumber = attempt + 1;
        const attemptResults = await this.executeToolCalls(pendingToolCalls, attemptNumber);
        allToolResults.push(...attemptResults);

        const failedResults = attemptResults.filter((result) => result.success === false);
        if (failedResults.length === 0) {
          break;
        }

        if (attempt >= MAX_TOOL_RETRIES) {
          logger.warn("lumina", `Tool retries exhausted after ${attemptNumber} attempts`);
          break;
        }

        const retryLabel = ToolDisplay.formatRetryUpdate(
          attemptNumber + 1,
          failedResults.map((result) => result.tool),
          failedResults[0]?.stderr || failedResults[0]?.result || "Retrying with corrected arguments"
        );
        onChunk?.("", `\n${retryLabel}`);

        const retryMessages = buildRetryMessages(baseMessages, userMessage, retrySourceResponse, failedResults);
        const retryResponse = await collectStream(retryMessages);
        retrySourceResponse = retryResponse;
        pendingToolCalls = parseToolCalls(retryResponse);

        if (pendingToolCalls.length === 0) {
          logger.warn("lumina", "Retry response did not include corrected tool calls");
          break;
        }
      }

      if (settings.features.toolDisplay) {
        const formattedResults = ToolDisplay.formatResultsInline(allToolResults);
        if (formattedResults) {
          onChunk?.("", `\n${formattedResults}`);
        }
      }

      logger.debug("lumina", `Tool execution completed: ${allToolResults.length} results`);

      if (this.chatManager) {
        this.chatManager.addToolResults(allToolResults);
      } else {
        this.context.add(
          "system",
          allToolResults.map(formatToolResultForContext).join("\n\n")
        );
      }

      return fullResponse;
    } catch (error) {
      if (error instanceof CancellationError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("lumina", `Chat error: ${err.message}`, err);
      const errorMsg = `❌ ${t("Error")}: ${err.message}`;

      if (!this.chatManager) {
        this.context.add("user", userMessage);
        this.context.add("assistant", errorMsg);
      }

      onChunk?.(errorMsg);
      return errorMsg;
    }
  }

  reset() {
    this.context.clear();
    this.chatManager?.clearCurrentChat();
  }

  private async executeToolCalls(toolCalls: ToolCall[], attempt: number): Promise<ToolResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const call of toolCalls) {
      logger.info("lumina", `Tool attempt ${attempt}: ${call.tool} ${call.arg}`);
      try {
        const result = await dispatch(call.tool, call.arg);
        logger.info(
          "lumina",
          `Tool attempt ${attempt} result: ${call.tool} success=${result.success} exit=${result.exitCode ?? "n/a"}`
        );
        results.push(result);
      } catch (error) {
        if (error instanceof CancellationError) {
          throw error;
        }
        const errMsg = logger.catchError(`tool:${call.tool}`, error);
        results.push({
          tool: call.tool,
          result: `${t("Error")}: ${errMsg}`,
          success: false,
          normalizedArg: call.arg.trim(),
          stderr: errMsg,
          exitCode: 1,
        });
      }
    }

    return toToolResults(results, attempt);
  }
}
