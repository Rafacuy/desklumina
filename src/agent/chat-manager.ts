import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

export type ToolCall = {
  tool: string;
  arg: string;
};

export type ToolResult = {
  tool: string;
  result: string;
};

export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
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
      this.currentChat = JSON.parse(data);
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

    const message: Message = {
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

  getLastToolContext(): { calls: ToolCall[]; results: ToolResult[] } | null {
    if (!this.currentChat || this.currentChat.messages.length === 0) return null;

    const recentMessages = [...this.currentChat.messages].reverse();
    for (const msg of recentMessages) {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          calls: msg.toolCalls,
          results: msg.toolResults || [],
        };
      }
    }
    return null;
  }

  getAllChats(): Chat[] {
    ensureChatDir();
    const files = readdirSync(CHAT_DIR).filter(f => f.endsWith(".json"));
    const chats: Chat[] = [];

    for (const file of files) {
      try {
        const data = readFileSync(join(CHAT_DIR, file), "utf-8");
        chats.push(JSON.parse(data));
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
      let content = m.content;
      
      // Append tool results to message content for context
      if (m.toolResults && m.toolResults.length > 0) {
        const resultsStr = m.toolResults.map(r => `[${r.tool}]: ${r.result}`).join("\n");
        content += `\n\n--- Tool Results ---\n${resultsStr}`;
      }
      
      messages.push({
        role: m.role,
        content,
      });
    }
    
    return messages;
  }

  getChatHistoryPreview(maxChars: number = 500): string {
    if (!this.currentChat || this.currentChat.messages.length === 0) {
      return "";
    }

    const preview: string[] = [];
    let totalChars = 0;

    const recentMessages = [...this.currentChat.messages].reverse();
    
    for (const msg of recentMessages) {
      const prefix = msg.role === "user" ? "You: " : "Lumina: ";
      const truncated = msg.content.length > 100 
        ? msg.content.substring(0, 100) + "..." 
        : msg.content;
      const line = prefix + truncated;
      
      if (totalChars + line.length > maxChars) break;
      preview.unshift(line);
      totalChars += line.length;
      
      // Add tool context if available
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        const toolLine = `  🔧 Tools: ${msg.toolCalls.map(t => t.tool).join(", ")}`;
        if (totalChars + toolLine.length <= maxChars) {
          preview.push(toolLine);
          totalChars += toolLine.length;
        }
      }
    }

    return preview.join("\n");
  }

  getToolContextPreview(): string {
    const toolContext = this.getLastToolContext();
    if (!toolContext) return "";

    const lines: string[] = [];
    
    if (toolContext.calls.length > 0) {
      lines.push("── Last Tool Calls ──");
      for (const call of toolContext.calls) {
        lines.push(`🔧 ${call.tool}: ${call.arg.substring(0, 50)}${call.arg.length > 50 ? "..." : ""}`);
      }
    }
    
    if (toolContext.results.length > 0) {
      lines.push("── Results ──");
      for (const result of toolContext.results) {
        const truncated = result.result.substring(0, 60);
        lines.push(`✓ ${result.tool}: ${truncated}${result.result.length > 60 ? "..." : ""}`);
      }
    }

    return lines.join("\n");
  }
}
