import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AIMessage, AIRequestContext, Chat, ChatMessage, ToolCall, ToolResult } from "../types";
import { settingsManager } from "./settings-manager";
import { logger } from "../logger";
import { t } from "../utils/i18n";

const TOOL_LABELS: Record<string, string> = {
  app: "Opening application",
  terminal: "Running terminal command",
  file: "Managing files",
  media: "Controlling media",
  clipboard: "Clipboard operation",
  notify: "Sending notification",
};

const CHAT_DIR = join(homedir(), ".config/desklumina/chats");
const MAX_CONTEXT_MESSAGES = 12;
const MAX_SUMMARY_CHARS = 240;

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
  const label = TOOL_LABELS[tool] || "Executing actions";
  return t(label);
}

function cleanContent(content: string): string {
  return content
    .replace(/```json\s*\n[\s\S]*?\n```/g, "")
    .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
    .replace(/^━+$/gm, "")
    .trim();
}

function formatToolContext(result: ToolResult): string {
  const status = result.success === false ? "FAILED" : "OK";
  const segments = [
    `[TOOL RESULT] ${result.tool} ${status}`,
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

  return segments.join("\n");
}

function summarizeMessage(message: InternalMessage): string {
  if (message.role === "tool") {
    const toolResults = message.toolResults || [];
    return toolResults
      .map((result) => {
        const status = result.success === false ? "failed" : "succeeded";
        return `${getToolLabel(result.tool)} ${status}: ${result.result}`;
      })
      .join(" | ")
      .slice(0, MAX_SUMMARY_CHARS);
  }

  const prefix = message.role === "user" ? "User" : "Assistant";
  return `${prefix}: ${cleanContent(message.content)}`.slice(0, MAX_SUMMARY_CHARS);
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

    const toolMessage: InternalMessage = {
      role: "tool",
      content: results.map(formatToolContext).join("\n\n"),
      timestamp: Date.now(),
      toolResults: results,
    };

    this.currentChat.messages.push(toolMessage);
    this.currentChat.updatedAt = Date.now();
    this.saveChat(this.currentChat);
  }

  getAllChats(): Chat[] {
    ensureChatDir();
    const files = readdirSync(CHAT_DIR).filter((f) => f.endsWith(".json"));
    const chats: Chat[] = [];

    for (const file of files) {
      try {
        const data = readFileSync(join(CHAT_DIR, file), "utf-8");
        chats.push(normalizeChat(JSON.parse(data) as Chat));
      } catch {}
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

    const relevant = this.currentChat.messages.filter((message) => message.role !== "system") as InternalMessage[];
    if (relevant.length <= MAX_CONTEXT_MESSAGES) {
      return {
        messages: relevant.map((message) => this.toAPIMessage(message)),
      };
    }

    const recentMessages = relevant.slice(-MAX_CONTEXT_MESSAGES);
    const olderMessages = relevant.slice(0, -MAX_CONTEXT_MESSAGES);
    const summaryLines = olderMessages
      .map(summarizeMessage)
      .filter(Boolean)
      .slice(-6);

    const messages: AIMessage[] = [];
    if (summaryLines.length > 0) {
      messages.push({
        role: "system",
        content: `Conversation summary (${olderMessages.length} earlier messages):\n${summaryLines.join("\n")}`,
      });
    }

    recentMessages.forEach((message) => {
      messages.push(this.toAPIMessage(message));
    });

    return {
      messages,
      truncatedMessageCount: olderMessages.length,
      summarizedMessageCount: summaryLines.length,
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

      const prefix = msg.role === "user" ? `󱜙 ${t("You")}:` : `󱜙 ${t("Lumina")}:`;
      const content = cleanContent(msg.content);
      if (!content) continue;

      const truncated = content.length > 100 ? `${content.slice(0, 100)}...` : content;
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
