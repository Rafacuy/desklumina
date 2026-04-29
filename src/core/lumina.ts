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
    `[TOOL RESULT] tool=file`,
    `status=${result.success === false ? "failed" : "ok"}`,
    result.normalizedArg ? `args=${result.normalizedArg}` : "",
    result.summary?.mode ? `search_mode=${result.summary.mode}` : "",
    result.summary?.query ? `query=${result.summary.query}` : "",
    result.summary?.totalMatches !== undefined ? `total_matches=${result.summary.totalMatches}` : "",
    result.summary?.filteredMatches !== undefined ? `filtered_matches=${result.summary.filteredMatches}` : "",
    result.selectedFile ? `selected_file=${result.selectedFile}` : "",
    files.length > 0 ? "matched_files:" : "",
    ...files.slice(0, 10).map((file, index) => `${index + 1}. ${file.path}`),
    result.preview?.path ? `preview_path=${result.preview.path}` : "",
    result.preview?.content ? `preview_excerpt=${result.preview.content.slice(0, 400).trim()}` : "",
    result.preview?.unavailableReason ? `preview_unavailable=${result.preview.unavailableReason}` : "",
    result.stderr ? `stderr=${result.stderr.trim()}` : "",
    result.success === false ? `message=${result.result.trim()}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

function formatToolResultForContext(result: ToolResult): string {
  if (result.tool === "file") {
    return formatFileToolResultForContext(result);
  }

  const lines = [
    `[TOOL RESULT] tool=${result.tool}`,
    `status=${result.success === false ? "failed" : "ok"}`,
    result.normalizedArg ? `args=${result.normalizedArg}` : "",
    result.command ? `command=${result.command}` : "",
    result.exitCode !== undefined ? `exit_code=${result.exitCode}` : "",
    result.stdout ? `stdout=${result.stdout.trim()}` : "",
    result.stderr ? `stderr=${result.stderr.trim()}` : "",
    result.actions && result.actions.length > 0 ? `actions=${result.actions.join(",")}` : "",
    result.selectedFile ? `selected_file=${result.selectedFile}` : "",
    result.files && result.files.length > 0 ? `files=${result.files.map((file) => file.path).join(" | ")}` : "",
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

function buildFollowUpMessages(
  baseMessages: AIMessage[],
  userMessage: string,
  previousAssistantResponse: string,
  toolResults: ToolResult[]
): AIMessage[] {
  const toolFeedback = toolResults.map(formatToolResultForContext).join("\n\n");

  return [
    ...baseMessages,
    { role: "assistant", content: cleanAssistantResponse(previousAssistantResponse) || previousAssistantResponse },
    {
      role: "system",
      content: [
        "Tool execution completed.",
        `Original user request: ${userMessage}`,
        "Write the final answer using only the actual tool results below.",
        "If the tool failed or found nothing, say that explicitly.",
        "Do not copy raw tool fields like status labels, summaries, actions, or numbered machine lists verbatim.",
        "Answer naturally and mention concrete file paths only when useful.",
        "Do not emit any more tool calls.",
        toolFeedback,
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
    onChunk?: (chunk: string, callback?: ToolCallbackPayload) => void
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

      if (settings.features.tts) {
        logger.debug("lumina", t("TTS enabled, triggering text-to-speech"));
        textToSpeech(fullResponse).catch((err) => {
          logger.error("lumina", t("TTS failed"), err instanceof Error ? err : new Error(String(err)));
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

        const retryMessages = buildRetryMessages(baseMessages, userMessage, retrySourceResponse, failedResults);
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

      const followUpMessages = buildFollowUpMessages(baseMessages, userMessage, retrySourceResponse, allToolResults);
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
