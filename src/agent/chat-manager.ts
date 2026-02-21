import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
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

  addMessage(content: string, role: "user" | "assistant"): void {
    if (!this.currentChat) {
      this.currentChat = this.createChat(content);
    }

    this.currentChat.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });

    if (this.currentChat.messages.length === 1 && role === "user") {
      this.currentChat.title = generateTitle(content);
    }

    this.currentChat.updatedAt = Date.now();
    this.saveChat(this.currentChat);
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
    return this.currentChat.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
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
    }

    return preview.join("\n");
  }
}
