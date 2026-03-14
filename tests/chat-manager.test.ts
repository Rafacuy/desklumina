import { describe, test, expect, beforeEach } from "bun:test";
import { ChatManager } from "../src/core/chat-manager";

describe("ChatManager", () => {
  let chatManager: ChatManager;

  beforeEach(() => {
    chatManager = new ChatManager();
  });

  test("creates new chat", () => {
    const chat = chatManager.createChat("Test message");
    expect(chat).toBeDefined();
    expect(chat.id).toBeDefined();
    expect(chat.title).toBeDefined();
  });

  test("adds messages correctly", () => {
    chatManager.createChat("Test");
    chatManager.addMessage("Hello", "user");
    const chat = chatManager.getCurrentChat();
    expect(chat?.messages).toHaveLength(1);
  });

  test("getCurrentChat returns current chat", () => {
    chatManager.createChat("Test");
    const chat = chatManager.getCurrentChat();
    expect(chat).not.toBeNull();
  });

  test("clearCurrentChat clears chat", () => {
    chatManager.createChat("Test");
    chatManager.clearCurrentChat();
    expect(chatManager.getCurrentChat()).toBeNull();
  });

  test("getMessagesForAPI returns formatted messages", () => {
    chatManager.createChat("Test");
    chatManager.addMessage("Hello", "user");
    const messages = chatManager.getMessagesForAPI();
    expect(Array.isArray(messages)).toBe(true);
  });
});
