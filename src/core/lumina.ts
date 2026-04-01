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
import type { ToolResult } from "../types";

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

    const contextMessages = this.chatManager
      ? this.chatManager.getMessagesForAPI()
      : this.context.getMessages();

    if (!this.chatManager) {
      this.context.add("user", userMessage);
    }

    const messages = [
      { role: "system" as const, content: await buildSystemPrompt() },
      ...contextMessages,
    ];

    let fullResponse = "";
    const settings = settingsManager.get();

    try {
      for await (const chunk of streamGroq(messages)) {
        fullResponse += chunk;
        onChunk?.(chunk);
      }

      logger.info("lumina", `Assistant: ${fullResponse.substring(0, 100)}...`);

      const toolCalls = parseToolCalls(fullResponse);

      // Save assistant message with tool calls BEFORE executing tools
      if (this.chatManager) {
        // Clean the response before saving (remove JSON and tool tags)
        const cleanResponse = fullResponse
          .replace(/```json\s*\n[\s\S]*?\n```/g, "")
          .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
          .trim();
        this.chatManager.addMessage(cleanResponse, "assistant", toolCalls);
      } else {
        this.context.add("assistant", fullResponse);
      }

      // TTS if enabled
      if (settings.features.tts) {
        logger.debug("lumina", t("TTS enabled, triggering text-to-speech"));
        textToSpeech(fullResponse).catch(err => {
          logger.error("lumina", t("TTS failed"), err instanceof Error ? err : new Error(String(err)));
        });
      }

      if (toolCalls.length > 0) {
        logger.info("lumina", `Executing ${toolCalls.length} tool call(s)`);

        const toolResults: ToolResult[] = [];

        for (const call of toolCalls) {
          try {
            const result = await dispatch(call.tool, call.arg);
            toolResults.push({ tool: call.tool, result });
          } catch (error) {
            const errMsg = logger.catchError(`tool:${call.tool}`, error);
            toolResults.push({ tool: call.tool, result: `${t("Error")}: ${errMsg}` });
          }
        }

        // Show formatted tool results with checkmarks
        if (settings.features.toolDisplay) {
          const formattedResults = ToolDisplay.formatResultsInline(toolResults);
          if (formattedResults) {
            onChunk?.("", `\n${formattedResults}`);
          }
        }

        logger.debug("lumina", `Tool execution completed: ${toolResults.length} results`);

        if (this.chatManager) {
          this.chatManager.addToolResults(toolResults);
        } else {
          const toolOutput = toolResults.map(r => `[${r.tool}] ${r.result}`).join("\n");
          this.context.add("user", `${t("Tool execution results")}:\n${toolOutput}`);
        }
      }

      return fullResponse;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("lumina", `Chat error: ${err.message}`, err);
      const errorMsg = `❌ ${t("Error")}: ${err.message}`;
      onChunk?.(errorMsg);
      return errorMsg;
    }
  }

  reset() {
    this.context.clear();
    this.chatManager?.clearCurrentChat();
  }
}
