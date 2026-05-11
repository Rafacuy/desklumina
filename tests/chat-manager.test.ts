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

  test("getMessagesForAPI prunes history based on tokens and adds summary", () => {
    chatManager.createChat("Test");
    
    // MAX_HISTORY_TOKENS is 4000
    // Add many large messages to exceed budget
    // Each message ~1000 tokens (4000 chars)
    const largeContent = "A".repeat(4000);
    for (let i = 0; i < 6; i++) {
      chatManager.addMessage(largeContent, "user");
      chatManager.addMessage("Short response", "assistant");
    }

    const context = chatManager.getMessagesForAPI();
    
    // Check that we have a summary system message at the start
    expect(context.messages[0]?.role).toBe("system");
    expect(context.messages[0]?.content).toContain("[History:");
    
    // Check that recent messages are preserved
    expect(context.messages.length).toBeLessThan(12); // Total 12 messages added + summary
    expect(context.truncatedMessageCount).toBeGreaterThan(0);
  });

  test("addToolResults compresses large results before saving", () => {
    chatManager.createChat("Tool Test");
    chatManager.addMessage("User query", "user"); // Add a user message first
    const largeResult = "B".repeat(2000);
    chatManager.addToolResults([{
      tool: "terminal",
      success: true,
      result: largeResult,
      normalizedArg: "ls -la",
      attempt: 1
    }]);

    const chat = chatManager.getCurrentChat();
    // Index 1 because Index 0 is the "User query" added above
    const toolMsg = chat?.messages[1];
    expect(toolMsg?.role).toBe("tool");
    // Should be truncated to 500 chars in memory/disk storage
    expect((toolMsg as any).toolResults[0].result.length).toBe(500);
  });

  test("prunes chats when exceeding MAX_CHATS", () => {
    const unlinkSpy = spyOn(fs, "unlinkSync").mockImplementation(() => {});
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(true);
    const readdirSpy = spyOn(fs, "readdirSync").mockReturnValue(
      Array.from({ length: 110 }, (_, i) => `chat-${i}.json`) as any
    );
    const statSpy = spyOn(fs, "statSync").mockReturnValue({ mtimeMs: Date.now() } as any);
    
    // Trigger pruning
    (chatManager as any).pruneChats();
    
    // Should attempt to delete 10 chats (110 - 100)
    expect(unlinkSpy).toHaveBeenCalledTimes(10);
    
    unlinkSpy.mockRestore();
    existsSpy.mockRestore();
    readdirSpy.mockRestore();
    statSpy.mockRestore();
  });

  test("prunes chats handles missing files gracefully (ENOENT fix)", () => {
    const unlinkSpy = spyOn(fs, "unlinkSync").mockImplementation(() => {});
    const existsSpy = spyOn(fs, "existsSync").mockReturnValue(false); // File doesn't exist
    const readdirSpy = spyOn(fs, "readdirSync").mockReturnValue(
      Array.from({ length: 110 }, (_, i) => `chat-${i}.json`) as any
    );
    const statSpy = spyOn(fs, "statSync").mockReturnValue({ mtimeMs: Date.now() } as any);
    
    // Trigger pruning
    (chatManager as any).pruneChats();
    
    // Should NOT call unlinkSync because existsSync returns false
    expect(unlinkSpy).not.toHaveBeenCalled();
    
    unlinkSpy.mockRestore();
    existsSpy.mockRestore();
    readdirSpy.mockRestore();
    statSpy.mockRestore();
  });
});
