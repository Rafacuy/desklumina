import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Chat, ChatMessage, ToolCall, ToolResult } from "../types";
import { settingsManager } from "./settings-manager";
import { t } from "../utils/i18n";

// Tool label mapping for history display
const TOOL_LABELS: Record<string, string> = {
  app: "Opening application",
  terminal: "Running terminal command",
  bspwm: "Managing windows",
  file: "Managing files",
  media: "Controlling media",
  clipboard: "Clipboard operation",
  notify: "Sending notification",
};

function getToolLabel(tool: string): string {
  const label = TOOL_LABELS[tool] || "Executing actions";
  return t(label);
}

export type { Chat, ChatMessage, ToolCall, ToolResult };

type InternalMessage = ChatMessage & {
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

const CHAT_DIR = join(homedir(), ".config/bspwm/agent/chats");

function ensureChatDir() {
  if (!existsSync(CHAT_DIR)) {
    mkdirSync(CHAT_DIR, { recursive: true });
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateTitle(firstMessage: string): string {
  const words = firstMessage.split(" ").slice(0, 4);
  let title = words.join(" ");
  if (firstMessage.split(" ").length > 4) title += "...";
  return title || "New Chat";
}

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
      this.currentChat = JSON.parse(data) as Chat;
      return this.currentChat;
    } catch {
      return null;
    }
  }

  saveChat(chat: Chat): void {
    ensureChatDir();
    const path = join(CHAT_DIR, `${chat.id}.json`);
    writeFileSync(path, JSON.stringify(chat, null, 2));
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
    };

    if (toolCalls) {
      message.toolCalls = toolCalls;
    }

    this.currentChat.messages.push(message);

    if (this.currentChat.messages.length === 1 && role === "user") {
      this.currentChat.title = generateTitle(content);
    }

    this.currentChat.updatedAt = Date.now();
    this.saveChat(this.currentChat);
  }

  addToolResults(results: ToolResult[]): void {
    if (!this.currentChat || this.currentChat.messages.length === 0) return;

    const lastMessage = this.currentChat.messages[this.currentChat.messages.length - 1];
    if (lastMessage && lastMessage.role === "assistant") {
      lastMessage.toolResults = results;
      this.currentChat.updatedAt = Date.now();
      this.saveChat(this.currentChat);
    }
  }

  getAllChats(): Chat[] {
    ensureChatDir();
    const files = readdirSync(CHAT_DIR).filter(f => f.endsWith(".json"));
    const chats: Chat[] = [];

    for (const file of files) {
      try {
        const data = readFileSync(join(CHAT_DIR, file), "utf-8");
        chats.push(JSON.parse(data) as Chat);
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

  getMessagesForAPI(): { role: "user" | "assistant"; content: string }[] {
    if (!this.currentChat) return [];

    const messages: { role: "user" | "assistant"; content: string }[] = [];

    for (const m of this.currentChat.messages) {
      if (m.role === "system") continue; // Skip system messages

      messages.push({
        role: m.role as "user" | "assistant",
        content: m.content,
      });
    }

    return messages;
  }

  getChatHistoryPreview(maxChars: number = 500): string {
    const settings = settingsManager.get();
    if (!settings.features.chatHistory) return "";

    if (!this.currentChat || this.currentChat.messages.length === 0) {
      return "";
    }

    const preview: string[] = [];
    let totalChars = 0;

    const recentMessages = [...this.currentChat.messages].reverse();

    for (const msg of recentMessages) {
      const prefix = msg.role === "user" ? `󱜙 ${t("You")}:` : `󱜙 ${t("Lumina")}:`;
      
      // Clean content: remove JSON blocks, tool tags, and separators
      let cleanContent = msg.content
        .replace(/```json\s*\n[\s\S]*?\n```/g, "")
        .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
        .replace(/^━+$/gm, "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
        .trim();
      
      // Skip if content is empty after cleaning
      if (!cleanContent) continue;
      
      const truncated = cleanContent.length > 100
        ? cleanContent.substring(0, 100) + "..."
        : cleanContent;
      const line = `${prefix} ${truncated}`;

      if (totalChars + line.length > maxChars) break;
      preview.unshift(line);
      totalChars += line.length;

      // Add tool results if available (compact format with checkmarks)
      if (msg.toolResults && msg.toolResults.length > 0 && settings.features.toolDisplay) {
        const uniqueTools = [...new Set(msg.toolResults.map((r) => r.tool))];
        uniqueTools.forEach((tool) => {
          const toolLine = `    • ${getToolLabel(tool)} ✓`;
          if (totalChars + toolLine.length <= maxChars) {
            preview.unshift(toolLine);
            totalChars += toolLine.length;
          }
        });
      }
    }

    return preview.join("\n");
  }
}
