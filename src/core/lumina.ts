import { streamGroq, textToSpeech } from "../ai";
import { buildSystemPrompt } from "../ai/prompts";
import { Context } from "./context";
import { ChatManager } from "./chat-manager";
import { parseToolCalls } from "./planner";
import { dispatch } from "../tools";
import { logger } from "../logger";
import { formatToolCalls, formatToolResults } from "../ui";
import { settingsManager } from "./settings-manager";
import type { ToolResult } from "../types";

export class Lumina {
  private context = new Context();
  private chatManager: ChatManager | undefined;

  constructor(chatManager?: ChatManager) {
    this.chatManager = chatManager;
  }

  async chat(userMessage: string, onChunk?: (chunk: string) => void): Promise<string> {
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

      if (!this.chatManager) {
        this.context.add("assistant", fullResponse);
      }
      logger.info("lumina", `Assistant: ${fullResponse}`);

      // TTS if enabled
      if (settings.features.tts) {
        logger.info("lumina", "TTS enabled, triggering text-to-speech...");
        textToSpeech(fullResponse);
      } else {
        logger.info("lumina", "TTS disabled in settings");
      }

      const toolCalls = parseToolCalls(fullResponse);

      if (toolCalls.length > 0) {
        // Show formatted tool calls
        if (settings.features.toolDisplay) {
          const formattedCalls = formatToolCalls(toolCalls);
          onChunk?.(formattedCalls ? `\n${formattedCalls}` : "");
        }

        const toolResults: ToolResult[] = [];

        for (const call of toolCalls) {
          const result = await dispatch(call.tool, call.arg);
          toolResults.push({ tool: call.tool, result });
        }

        // Show formatted results
        if (settings.features.toolDisplay) {
          const formattedResults = formatToolResults(toolResults);
          onChunk?.(formattedResults ? `\n${formattedResults}` : "");
        }

        logger.info("lumina", `Tool results: ${JSON.stringify(toolResults)}`);

        if (this.chatManager) {
          this.chatManager.addToolResults(toolResults);
        } else {
          const toolOutput = toolResults.map(r => `[${r.tool}] ${r.result}`).join("\n");
          this.context.add("user", `Tool execution results:\n${toolOutput}`);
        }
      }

      return fullResponse;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error("lumina", `Error: ${msg}`);
      return `❌ Error: ${msg}`;
    }
  }

  reset() {
    this.context.clear();
    this.chatManager?.clearCurrentChat();
  }
}
