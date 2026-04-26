import { describe, test, expect, beforeEach, mock } from "bun:test";

let streamInvocations = 0;
let capturedMessages: Array<Array<{ role: string; content: string }>> = [];
let dispatchCalls: Array<{ tool: string; arg: string }> = [];

const mockStreamGroq = mock(async function* (messages: Array<{ role: string; content: string }>) {
  capturedMessages.push(messages);
  streamInvocations++;

  if (streamInvocations === 1) {
    yield 'On it.\n```json\n{"tool":"media","args":"volume up"}\n```';
    return;
  }

  if (streamInvocations === 2) {
    yield 'Retrying.\n```json\n{"tool":"media","args":"volume +10"}\n```';
    return;
  }

  yield "Volume updated to 10%.";
});

const mockDispatch = mock(async (tool: string, arg: string) => {
  dispatchCalls.push({ tool, arg });

  if (arg === "volume up") {
    return {
      tool,
      result: "❌ Invalid volume format",
      success: false,
      normalizedArg: arg,
      stderr: "Invalid volume format",
      exitCode: 2,
    };
  }

  return {
    tool,
    result: "✓ Volume updated",
    success: true,
    normalizedArg: arg,
    stdout: "volume: 10%",
    exitCode: 0,
  };
});

mock.module("../src/ai", () => ({
  streamGroq: mockStreamGroq,
  textToSpeech: mock(async () => {}),
}));

mock.module("../src/ai/prompts", () => ({
  buildSystemPrompt: mock(async () => "System prompt"),
}));

mock.module("../src/tools", () => ({
  dispatch: mockDispatch,
}));

mock.module("../src/logger", () => ({
  logger: {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    catchError: mock((_module: string, error: unknown) => String(error)),
  },
}));

mock.module("../src/ui/tool-display", () => ({
  ToolDisplay: {
    formatResultsInline: mock(() => "formatted-results"),
    formatRetryUpdate: mock(() => "retry-update"),
  },
}));

mock.module("../src/utils", () => ({
  t: (value: string) => value,
}));

import { Lumina } from "../src/core/lumina";
import { ChatManager } from "../src/core/chat-manager";
import { settingsManager } from "../src/core/settings-manager";
import { spyOn, afterAll, beforeAll } from "bun:test";

describe("Lumina", () => {
  let getSpy: any;
  let saveSpy: any;
  let toggleSpy: any;

  beforeAll(() => {
    // Mock settingsManager to avoid side effects and provide controlled state
    getSpy = spyOn(settingsManager, "get").mockReturnValue({
      language: "en",
      features: {
        tts: false,
        toolDisplay: true,
        chatHistory: true,
        dangerousCommandConfirmation: true,
      },
      tts: {
        voiceId: "en-US-AvaNeural",
        speed: 1,
      },
    });
    saveSpy = spyOn(settingsManager, "save").mockResolvedValue(Promise.resolve() as any);
    toggleSpy = spyOn(settingsManager, "toggleFeature").mockImplementation(() => {});
  });

  afterAll(() => {
    getSpy.mockRestore();
    saveSpy.mockRestore();
    toggleSpy.mockRestore();
  });

  beforeEach(() => {
    streamInvocations = 0;
    capturedMessages = [];
    dispatchCalls = [];
    mockStreamGroq.mockClear();
    mockDispatch.mockClear();
  });

  test("always includes the live user message in the outgoing API payload", async () => {
    const lumina = new Lumina();

    await lumina.chat("set volume to 30");

    expect(capturedMessages).toHaveLength(3);
    expect(capturedMessages[0]?.[capturedMessages[0].length - 1]).toEqual({
      role: "user",
      content: "set volume to 30",
    });
  });

  test("feeds failed tool results back into the retry request and produces a final grounded reply", async () => {
    const lumina = new Lumina();
    const toolOutputs: Array<{ text: string; type: string }> = [];
    let finalText = "";

    await lumina.chat("volume up", (chunk, toolOutput) => {
      if (toolOutput) {
        toolOutputs.push({ text: toolOutput.text, type: toolOutput.type });
      }
      finalText += chunk;
    });

    expect(streamInvocations).toBe(3);
    expect(dispatchCalls).toEqual([
      { tool: "media", arg: "volume up" },
      { tool: "media", arg: "volume +10" },
    ]);
    expect(capturedMessages[1]?.some((message) => message.content.includes("[TOOL RESULT] tool=media"))).toBe(true);
    expect(capturedMessages[2]?.some((message) => message.content.includes("Tool execution completed."))).toBe(true);
    expect(toolOutputs.some((entry) => entry.type === "retry" && entry.text.includes("retry-update"))).toBe(true);
    expect(toolOutputs.some((entry) => entry.type === "results")).toBe(true);
    expect(finalText).toContain("Volume updated to 10%.");
  });

  test("persists tool result messages in chat history", async () => {
    const chatManager = new ChatManager();
    const lumina = new Lumina(chatManager);

    await lumina.chat("volume up");

    const currentChat = chatManager.getCurrentChat();
    expect(currentChat?.messages.some((message) => message.role === "tool")).toBe(true);
    expect(currentChat?.messages.filter((message) => message.role === "assistant").length).toBeGreaterThan(1);
  });
});
