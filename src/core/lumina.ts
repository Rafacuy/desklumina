import { streamGroq } from "../ai";
import { buildSystemPrompt } from "../ai/prompts";
import { Context } from "./context";
import { ChatManager } from "./chat-manager";
import { parseToolCalls } from "./planner";
import { dispatch } from "../tools";
import { logger } from "../logger";
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

    try {
      for await (const chunk of streamGroq(messages)) {
        fullResponse += chunk;
        onChunk?.(chunk);
      }

      if (!this.chatManager) {
        this.context.add("assistant", fullResponse);
      }
      logger.info("lumina", `Assistant: ${fullResponse}`);

      const toolCalls = parseToolCalls(fullResponse);

      if (toolCalls.length > 0) {
        const toolResults: ToolResult[] = [];
        const results: string[] = [];

        for (const call of toolCalls) {
          const result = await dispatch(call.tool, call.arg);
          toolResults.push({ tool: call.tool, result });
          results.push(`[${call.tool}] ${result}`);
        }

        const toolOutput = results.join("\n");
        logger.info("lumina", `Tool results: ${toolOutput}`);

        if (this.chatManager) {
          this.chatManager.addToolResults(toolResults);
        } else {
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
