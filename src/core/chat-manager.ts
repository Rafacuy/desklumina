import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AIMessage, AIRequestContext, Chat, ChatMessage, ToolCall, ToolResult, ChatMetadata } from "../types";
import { settingsManager } from "./settings-manager";
import { logger } from "../logger";
import { t, cleanAssistantResponse } from "../utils";
import { tokenManager } from "./token-manager";

const TOOL_LABELS: Record<string, string> = {
  app: "tool.opening_app",
  terminal: "tool.running_terminal",
  file: "tool.managing_files",
  media: "tool.controlling_media",
  clipboard: "tool.clipboard",
  notify: "tool.sending_notification",
};

const CHAT_DIR = join(homedir(), ".config/desklumina/chats");
const MAX_HISTORY_TOKENS = 4000;
const MAX_CHATS = 100;

type InternalMessage = ChatMessage & {
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

function ensureChatDir() {
  if (!existsSync(CHAT_DIR)) {
    mkdirSync(CHAT_DIR, { recursive: true });
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

function generateTitle(firstMessage: string): string {
  const words = firstMessage.split(" ").slice(0, 4);
  let title = words.join(" ");
  if (firstMessage.split(" ").length > 4) title += "...";
  return title || "New Chat";
}

function getToolLabel(tool: string): string {
  const label = TOOL_LABELS[tool] || "tool.executing_actions";
  return t(label);
}

function cleanContent(content: string): string {
  return cleanAssistantResponse(content);
}

function formatToolContext(result: ToolResult): string {
  const status = result.success === false ? "FAILED" : "OK";
  const segments = [
    `[TOOL RESULT] ${result.tool} ${status}`,
    result.normalizedArg ? `args=${result.normalizedArg}` : "",
    result.stdout ? `stdout=${result.stdout.slice(0, 200).trim()}` : "",
    result.stderr ? `stderr=${result.stderr.slice(0, 150).trim()}` : "",
    `msg=${result.result.slice(0, 150).trim()}`,
  ].filter(Boolean);

  return segments.join("\n");
}

function summarizeMessage(message: InternalMessage): string {
  if (message.role === "tool") {
    const toolResults = message.toolResults || [];
    return toolResults
      .map((result) => {
        const status = result.success === false ? "failed" : "ok";
        return `${result.tool}(${status})`;
      })
      .join(", ");
  }

  const prefix = message.role === "user" ? "U" : "A";
  const content = cleanContent(message.content);
  return `${prefix}: ${content.length > 100 ? content.slice(0, 100) + "..." : content}`;
}

function normalizeChat(chat: Chat): Chat {
  const messages = chat.messages.map((message) => ({
    ...message,
    timestamp: message.timestamp || chat.updatedAt,
  }));

  return { ...chat, messages };
}

export type { Chat, ChatMessage, ToolCall, ToolResult };

export class ChatManager {
  private currentChat: Chat | null = null;

  constructor() {
    ensureChatDir();
  }

  createChat(firstMessage?: string): Chat {
    this.pruneChats();
    const chat: Chat = {
      id: generateId(),
      title: firstMessage ? generateTitle(firstMessage) : "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.currentChat = chat;
    this.saveChat(chat);
    return chat;
  }

  private pruneChats(): void {
    try {
      ensureChatDir();
      const files = readdirSync(CHAT_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => ({
          name: f,
          path: join(CHAT_DIR, f),
          mtime: statSync(join(CHAT_DIR, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > MAX_CHATS) {
        const toDelete = files.slice(MAX_CHATS);
        for (const file of toDelete) {
          try {
            if (existsSync(file.path)) {
              unlinkSync(file.path);
              logger.info("chat-manager", `Pruned old chat: ${file.name}`);
            }
          } catch (err) {
            logger.error("chat-manager", `Failed to prune chat ${file.name}: ${err}`);
          }
        }
      }
    } catch (err) {
      logger.error("chat-manager", `Error during chat pruning: ${err}`);
    }
  }

  loadChat(chatId: string): Chat | null {
    const path = join(CHAT_DIR, `${chatId}.json`);
    if (!existsSync(path)) return null;

    try {
      const data = readFileSync(path, "utf-8");
      this.currentChat = normalizeChat(JSON.parse(data) as Chat);
      return this.currentChat;
    } catch {
      return null;
    }
  }

  saveChat(chat: Chat): void {
    ensureChatDir();
    const path = join(CHAT_DIR, `${chat.id}.json`);
    const tempPath = `${path}.tmp`;
    try {
      writeFileSync(tempPath, JSON.stringify(chat, null, 2));
      renameSync(tempPath, path);
    } catch (err) {
      logger.error("chat-manager", `Failed to save chat: ${err}`);
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  }

  getCurrentChat(): Chat | null {
    return this.currentChat;
  }

  addMessage(content: string, role: "user" | "assistant", toolCalls?: ToolCall[]): void {
    if (!this.currentChat) {
      this.currentChat = this.createChat(content);
    }

    const message: InternalMessage = {
      role,
      content,
      timestamp: Date.now(),
      ...(toolCalls ? { toolCalls } : {}),
    };

    this.currentChat.messages.push(message);

    if (this.currentChat.messages.length === 1 && role === "user") {
      this.currentChat.title = generateTitle(content);
    }

    this.currentChat.updatedAt = Date.now();
    this.saveChat(this.currentChat);
  }

  addToolResults(results: ToolResult[]): void {
    if (!this.currentChat || results.length === 0) return;

    // Optimization: Strip redundant fields before saving to disk
    const compressedResults = results.map(r => ({
      tool: r.tool,
      success: r.success,
      result: r.result.slice(0, 500), // Hard cap result length on disk
      normalizedArg: r.normalizedArg,
      attempt: r.attempt
    })) as ToolResult[];

    const toolMessage: InternalMessage = {
      role: "tool",
      content: compressedResults.map(formatToolContext).join("\n\n"),
      timestamp: Date.now(),
      toolResults: compressedResults,
    };

    this.currentChat.messages.push(toolMessage);
    this.currentChat.updatedAt = Date.now();
    this.saveChat(this.currentChat);
  }

  getAllChats(): (ChatMetadata & { lastMessage?: string })[] {
    ensureChatDir();
    const files = readdirSync(CHAT_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: join(CHAT_DIR, f),
        mtime: statSync(join(CHAT_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, MAX_CHATS);

    const chats: (ChatMetadata & { lastMessage?: string })[] = [];

    for (const file of files) {
      try {
        const data = readFileSync(file.path, "utf-8");
        const chat = JSON.parse(data) as Chat;
        
        if (chat.id && chat.title) {
          const lastMsg = chat.messages.length > 0 
            ? chat.messages[chat.messages.length - 1]?.content || ""
            : "";
            
          chats.push({
            id: chat.id,
            title: chat.title,
            messageCount: chat.messages.length,
            updatedAt: chat.updatedAt || 0,
            lastMessage: lastMsg,
          });
        }
      } catch (err) {
        logger.error("chat-manager", `Failed to parse chat ${file.name}: ${err}`);
      }
    }

    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  deleteChat(chatId: string): void {
    const path = join(CHAT_DIR, `${chatId}.json`);
    if (existsSync(path)) {
      unlinkSync(path);
    }
    if (this.currentChat?.id === chatId) {
      this.currentChat = null;
    }
  }

  clearCurrentChat(): void {
    this.currentChat = null;
  }

  removeLastMessage(): void {
    if (!this.currentChat || this.currentChat.messages.length === 0) return;
    this.currentChat.messages.pop();
    this.currentChat.updatedAt = Date.now();
    this.saveChat(this.currentChat);
  }

  getMessagesForAPI(): AIRequestContext {
    if (!this.currentChat) {
      return { messages: [] };
    }

    const relevant = this.currentChat.messages
      .filter((message) => message.role !== "system")
      .filter((message) => message.content && message.content.trim() !== "") as InternalMessage[];

    let totalTokens = 0;
    const recentMessages: AIMessage[] = [];
    const olderMessages: InternalMessage[] = [];

    // Iterate backwards to keep the most recent messages
    for (let i = relevant.length - 1; i >= 0; i--) {
      const msg = relevant[i]!;
      const apiMsg = this.toAPIMessage(msg);
      const tokens = tokenManager.estimateTokens(apiMsg.content);

      if (totalTokens + tokens <= MAX_HISTORY_TOKENS) {
        recentMessages.unshift(apiMsg);
        totalTokens += tokens;
      } else {
        olderMessages.unshift(msg);
      }
    }

    const messages: AIMessage[] = [];
    if (olderMessages.length > 0) {
      const summaryLines = olderMessages
        .slice(-5) // Take last 5 from older for summary
        .map(summarizeMessage);
      
      messages.push({
        role: "system",
        content: `[History: ${olderMessages.length} msgs]\n${summaryLines.join("\n")}`,
      });
    }

    messages.push(...recentMessages);

    return {
      messages,
      truncatedMessageCount: olderMessages.length,
      summarizedMessageCount: Math.min(olderMessages.length, 5),
    };
  }

  getChatHistoryPreview(maxChars: number = 500): string {
    const settings = settingsManager.get();
    if (!settings.features.chatHistory) return "";

    if (!this.currentChat || this.currentChat.messages.length === 0) {
      return "";
    }

    const preview: string[] = [];
    let totalChars = 0;

    const recentMessages = [...this.currentChat.messages].reverse() as InternalMessage[];

    for (const msg of recentMessages) {
      if (msg.role === "tool") {
        const toolLine = (msg.toolResults || [])
          .map((result) => `    • ${getToolLabel(result.tool)} ${result.success === false ? "✕" : "✓"}`)
          .join("\n");
        if (toolLine && totalChars + toolLine.length <= maxChars) {
          preview.unshift(toolLine);
          totalChars += toolLine.length;
        }
        continue;
      }

      const prefix = msg.role === "user" ? `󱜙 ${t("common.you")}:` : `󱜙 ${t("common.lumina")}:`;
      const content = cleanContent(msg.content);
      if (!content) continue;

      const chars = Array.from(content);
      const truncated = chars.length > 100 ? `${chars.slice(0, 100).join("")}...` : content;
      const line = `${prefix} ${truncated}`;

      if (totalChars + line.length > maxChars) break;
      preview.unshift(line);
      totalChars += line.length;
    }

    return preview.join("\n");
  }

  private toAPIMessage(message: InternalMessage): AIMessage {
    if (message.role === "tool") {
      return {
        role: "system",
        content: message.content,
      };
    }

    return {
      role: message.role,
      content: message.content,
    };
  }
}
