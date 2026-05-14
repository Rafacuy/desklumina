import { t, cleanAssistantResponse } from "../utils";
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
import type { AIMessage, ToolCall, ToolCallbackPayload, ToolExecutionResult, ToolResult } from "../types";

const MAX_TOOL_RETRIES = 2;

function formatFileToolResultForContext(result: ToolResult): string {
  const files = result.files || [];
  const lines = [
    `[TOOL RESULT] tool=file status=${result.success === false ? "failed" : "ok"}`,
    result.normalizedArg ? `args=${result.normalizedArg}` : "",
    result.summary?.totalMatches !== undefined ? `matches=${result.summary.totalMatches}` : "",
    result.selectedFile ? `file=${result.selectedFile}` : "",
    files.length > 0 ? "files:" : "",
    ...files.slice(0, 3).map((file) => `  - ${file.path}`),
    files.length > 3 ? `  - (...and ${files.length - 3} more)` : "",
    result.preview?.content ? `preview=${result.preview.content.slice(0, 200).trim()}` : "",
    result.stderr ? `stderr=${result.stderr.slice(0, 150).trim()}` : "",
    result.success === false ? `msg=${result.result.slice(0, 150).trim()}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

function formatToolResultForContext(result: ToolResult): string {
  if (result.tool === "file") {
    return formatFileToolResultForContext(result);
  }

  const lines = [
    `[TOOL RESULT] tool=${result.tool} status=${result.success === false ? "failed" : "ok"}`,
    result.normalizedArg ? `args=${result.normalizedArg}` : "",
    result.stdout ? `stdout=${result.stdout.slice(0, 250).trim()}` : "",
    result.stderr ? `stderr=${result.stderr.slice(0, 150).trim()}` : "",
    `msg=${result.result.slice(0, 150).trim()}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildRetryMessages(
  systemPrompt: string,
  originalUserMessage: string,
  previousAssistantResponse: string,
  failedResults: ToolResult[],
  attempt: number
): AIMessage[] {
  const retryFeedback = failedResults.map(formatToolResultForContext).join("\n\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: originalUserMessage },
    { role: "assistant", content: previousAssistantResponse },
    {
      role: "system",
      content: `[Escalation: Failure ${attempt}] Tool call failed. Correct args and retry:\n\n${retryFeedback}`,
    },
  ];
}

function buildFollowUpMessages(
  systemPrompt: string,
  userMessage: string,
  previousAssistantResponse: string,
  toolResults: ToolResult[]
): AIMessage[] {
  const toolFeedback = toolResults.map(formatToolResultForContext).join("\n\n");
  const anyFailed = toolResults.some(r => r.success === false);
  const failureEscalation = anyFailed ? "\n\n[Escalation: Failure 3] Multiple attempts failed. Produce a structured failure report." : "";

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
    { role: "assistant", content: cleanAssistantResponse(previousAssistantResponse) || previousAssistantResponse },
    {
      role: "system",
      content: `Tool results:\n\n${toolFeedback}${failureEscalation}\n\nSynthesize a natural, concise reply. No more tool calls.`,
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

export class Lumina {
  private context = new Context();
  private chatManager: ChatManager | undefined;

  constructor(chatManager?: ChatManager) {
    this.chatManager = chatManager;
  }

  async chat(
    userMessage: string,
    onChunk?: (chunk: string, callback?: ToolCallbackPayload) => void
  ): Promise<string> {
    logger.info("lumina", `User: ${userMessage}`);

    const systemPrompt = await buildSystemPrompt(userMessage);
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

      if (settings.features.tts) {
        logger.debug("lumina", "TTS enabled, triggering text-to-speech");
        textToSpeech(fullResponse).catch((err) => {
          logger.error("lumina", "TTS failed", err instanceof Error ? err : new Error(String(err)));
        });
      }

      if (initialToolCalls.length === 0) {
        if (this.chatManager) {
          this.chatManager.addMessage(cleanResponse, "assistant", initialToolCalls);
        } else {
          this.context.add("user", userMessage);
          this.context.add("assistant", cleanResponse || fullResponse);
        }
        return fullResponse;
      }

      if (this.chatManager) {
        this.chatManager.addMessage(cleanResponse, "assistant", initialToolCalls);
      } else {
        this.context.add("user", userMessage);
        this.context.add("assistant", cleanResponse || fullResponse);
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
        onChunk?.("", {
          type: "retry",
          text: `\n${retryLabel}`,
          tools: failedResults.map((result) => result.tool),
          reason: failedResults[0]?.stderr || failedResults[0]?.result || "Retrying with corrected arguments",
          results: failedResults,
        });

        const retryMessages = buildRetryMessages(systemPrompt, userMessage, retrySourceResponse, failedResults, attemptNumber);
        const retryResponse = await collectStream(retryMessages);
        retrySourceResponse = retryResponse;
        pendingToolCalls = parseToolCalls(retryResponse);

        if (pendingToolCalls.length === 0) {
          logger.warn("lumina", "Retry response did not include corrected tool calls");
          break;
        }
      }

      const formattedResults = ToolDisplay.formatResultsInline(allToolResults);
      if (formattedResults || allToolResults.length > 0) {
        onChunk?.("", {
          type: "results",
          text: settings.features.toolDisplay && formattedResults ? `\n${formattedResults}` : "",
          results: allToolResults,
        });
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

      const followUpMessages = buildFollowUpMessages(systemPrompt, userMessage, retrySourceResponse, allToolResults);
      const followUpResponse = await collectStream(followUpMessages, (chunk) => onChunk?.(chunk));
      const cleanFollowUp = cleanAssistantResponse(followUpResponse);

      if (this.chatManager) {
        this.chatManager.addMessage(cleanFollowUp || followUpResponse, "assistant");
      } else {
        this.context.add("assistant", cleanFollowUp || followUpResponse);
      }

      return followUpResponse;
    } catch (error) {
      if (error instanceof CancellationError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("lumina", `Chat error: ${err.message}`, err);
      const errorMsg = `${t("common.error")}.`;

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
    const results = await Promise.all(
      toolCalls.map(async (call) => {
        logger.info("lumina", `Tool attempt ${attempt}: ${call.tool} ${call.arg}`);
        try {
          const result = await dispatch(call.tool, call.arg);
          logger.info(
            "lumina",
            `Tool attempt ${attempt} result: ${call.tool} success=${result.success} exit=${result.exitCode ?? "n/a"}`
          );
          return { ...result, attempt };
        } catch (error) {
          if (error instanceof CancellationError) {
            throw error;
          }
          const errMsg = logger.catchError(`tool:${call.tool}`, error);
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
      })
    );

    return results;
  }
}
