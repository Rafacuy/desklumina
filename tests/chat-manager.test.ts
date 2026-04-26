import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { ChatManager } from "../src/core/chat-manager";
import * as fs from "fs";

describe("ChatManager", () => {
  let chatManager: ChatManager;

  beforeEach(() => {
    chatManager = new ChatManager();
  });

  test("saveChat uses atomic write (renameSync)", () => {
    const renameSpy = spyOn(fs, "renameSync");
    const chat = chatManager.createChat("Test atomic write");
    
    chatManager.saveChat(chat);
    
    expect(renameSpy).toHaveBeenCalled();
    renameSpy.mockRestore();
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
    const context = chatManager.getMessagesForAPI();
    expect(Array.isArray(context.messages)).toBe(true);
    expect(context.messages[0]?.content).toBe("Hello");
  });
});
