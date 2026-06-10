import { t, tf, cleanAssistantResponse } from "../utils";
import { textToSpeech, initializeAI } from "../ai";
import { buildSystemPrompt } from "../ai/runtime/prompts";
import { Context } from "./context";
import { ChatManager } from "./services/chat-manager";
import { logger } from "../logger";
import { settingsManager } from "./services/settings-manager";
import { CancellationError } from "../types";
import { runAgent } from "../agent/agent";
import { stripMarkersForDisplay } from "../agent/signals";
import { ToolDisplay } from "../ui/tool-display";
import { triggerLtmExtraction } from "../ltm";
import type { AIMessage, ToolCallbackPayload } from "../types";
import type { AgentEvent } from "../agent/types";

export class Lumina {
  private context = new Context();
  private chatManager: ChatManager | undefined;

  constructor(chatManager?: ChatManager) {
    this.chatManager = chatManager;
    initializeAI();
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

    const settings = settingsManager.get();
    const showToolDisplay = onChunk && settings.features.toolDisplay;

    try {
      const { finalResponse, allToolResults, history, terminalSignal } = await runAgent(
        baseMessages,
        {
          onEvent: (event: AgentEvent) => {
            if (event.type === "content") {
              onChunk?.(stripMarkersForDisplay(event.content));
            } else if (event.type === "tool_pending" && showToolDisplay) {
              const text = ToolDisplay.formatInline(event.tools);
              if (text) {
                onChunk?.("", {
                  type: "pending",
                  text: `\n${text}`,
                  tools: event.tools.map((t) => t.tool),
                });
              }
            } else if (event.type === "tool_retry" && showToolDisplay) {
              const text = ToolDisplay.formatRetryUpdate(
                event.attempt,
                [event.tool],
                event.error
              );
              onChunk?.("", {
                type: "retry",
                text: `\n${text}`,
                tools: [event.tool],
                reason: event.error,
              });
            } else if (event.type === "tool_results" && showToolDisplay) {
              const text = ToolDisplay.formatResultsInline(event.results);
              onChunk?.("", {
                type: "results",
                text: text ? `\n${text}` : "",
                results: event.results,
              });
            }
          },
        }
      );

      logger.info("lumina", `Agent loop completed: ${finalResponse.substring(0, 100)}...`);

      const userFacingResponse = terminalSignal?.type === "FAIL"
        ? (terminalSignal.reason
          ? tf("signal.soft_fail_reason", { reason: terminalSignal.reason })
          : t("signal.soft_fail"))
        : finalResponse;

      const cleanResponse = cleanAssistantResponse(userFacingResponse);

      if (settings.features.tts) {
        logger.debug("lumina", "TTS enabled, triggering text-to-speech");
        textToSpeech(userFacingResponse).catch((err) => {
          logger.error("lumina", "TTS failed", err instanceof Error ? err : new Error(String(err)));
        });
      }

      if (this.chatManager) {
        if (allToolResults.length > 0) {
          this.chatManager.addToolResults(allToolResults);
        }
        this.chatManager.addMessage(cleanResponse || userFacingResponse, "assistant");
      } else {
        this.context.add("user", userMessage);
        this.context.add("assistant", cleanResponse || userFacingResponse);
      }

      triggerLtmExtraction(userMessage, cleanResponse || userFacingResponse);

      return userFacingResponse;
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
}
