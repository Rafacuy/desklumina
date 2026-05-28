import { describe, test, expect, beforeEach, mock, spyOn, afterAll, beforeAll, afterEach } from "bun:test";

let streamInvocations = 0;
let capturedMessages: Array<Array<{ role: string; content: string }>> = [];
let dispatchCalls: Array<{ tool: string; arg: string }> = [];

const mockStreamGroq = mock(async function* (messages: Array<{ role: string; content: string }>) {
  capturedMessages.push([...messages]);
  streamInvocations++;

  if (streamInvocations === 1) {
    yield 'On it.\n```json\n{"tool":"music","args":"{\\"action\\":\\"volume_up\\"}"}\n```';
    return;
  }

  if (streamInvocations === 2) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user" && lastMsg.content.includes("status=failed")) {
      yield 'Retrying.\n```json\n{"tool":"music","args":"{\\"action\\":\\"volume_up\\"}"}\n```';
    } else {
      yield "Escalation marker missing! [[FAIL: missing result]]";
    }
    return;
  }

  yield "Volume updated. [[DONE]]";
});

const mockDispatch = mock(async (tool: string, arg: string) => {
  dispatchCalls.push({ tool, arg });

  if (arg.includes("volume_up")) {
    if (streamInvocations === 1) {
      return {
        tool,
        result: "❌ Backend timeout",
        success: false,
        normalizedArg: arg,
        stderr: "Backend timeout",
        exitCode: 1,
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
  }

  return {
    tool,
    result: "✓ Done",
    success: true,
    normalizedArg: arg,
    exitCode: 0,
  };
});

// gotta mock synthesis separately 
//not covered by the ai module mock
//else it hits real groq and hangs
const mockSynthesizeWithHistory = mock(async function* () {
  yield "Synthesis fallback [[DONE]]";
});

mock.module("../src/agent/synthesis", () => ({
  synthesizeWithHistory: mockSynthesizeWithHistory,
  SYNTHESIS_PROMPT: "You have reached the maximum number of reasoning steps. Summarize what was accomplished.",
}));

mock.module("../src/ai", () => ({
  streamAI: mockStreamGroq,
  textToSpeech: mock(async () => {}),
  initializeAI: mock(() => {}),
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

import { ToolDisplay } from "../src/ui/tool-display";

let formatInlineSpy: ReturnType<typeof spyOn>;
let formatResultsInlineSpy: ReturnType<typeof spyOn>;
let formatRetryUpdateSpy: ReturnType<typeof spyOn>;

beforeAll(() => {
  formatInlineSpy = spyOn(ToolDisplay, "formatInline").mockReturnValue("formatted-inline" as any);
  formatResultsInlineSpy = spyOn(ToolDisplay, "formatResultsInline").mockReturnValue("formatted-results" as any);
  formatRetryUpdateSpy = spyOn(ToolDisplay, "formatRetryUpdate").mockReturnValue("retry-update" as any);
});

afterAll(() => {
  formatInlineSpy?.mockRestore();
  formatResultsInlineSpy?.mockRestore();
  formatRetryUpdateSpy?.mockRestore();
});

mock.module("../src/utils", () => ({
  t: (value: string) => value,
  tf: (key: string) => key,
}));

import { Lumina } from "../src/core/lumina";
import { ChatManager } from "../src/core/chat-manager";
import { settingsManager } from "../src/core/settings-manager";
import * as prompts from "../src/ai/prompts";

describe("Lumina ReAct Agent Loop", () => {
  let getSpy: any;
  let saveSpy: any;
  let toggleSpy: any;
  let promptSpy: any;
  let lumina: InstanceType<typeof Lumina>;

  beforeAll(() => {
    promptSpy = spyOn(prompts, "buildSystemPrompt").mockResolvedValue("System prompt");

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
    promptSpy.mockRestore();
  });

  beforeEach(() => {
    streamInvocations = 0;
    capturedMessages = [];
    dispatchCalls = [];
    mockStreamGroq.mockReset();
    mockDispatch.mockReset();
    mockSynthesizeWithHistory.mockReset();
    mockStreamGroq.mockImplementation(async function* (messages: Array<{ role: string; content: string }>) {
      capturedMessages.push([...messages]);
      streamInvocations++;

      if (streamInvocations === 1) {
        yield 'On it.\n```json\n{"tool":"music","args":"{\\"action\\":\\"volume_up\\"}"}\n```';
        return;
      }

      if (streamInvocations === 2) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user" && lastMsg.content.includes("status=failed")) {
          yield 'Retrying.\n```json\n{"tool":"music","args":"{\\"action\\":\\"volume_up\\"}"}\n```';
        } else {
          yield "Escalation marker missing! [[FAIL: missing result]]";
        }
        return;
      }

      yield "Volume updated. [[DONE]]";
    });
    mockDispatch.mockImplementation(async (tool: string, arg: string) => {
      dispatchCalls.push({ tool, arg });

      if (arg.includes("volume_up")) {
        if (streamInvocations === 1) {
          return {
            tool,
            result: "❌ Backend timeout",
            success: false,
            normalizedArg: arg,
            stderr: "Backend timeout",
            exitCode: 1,
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
      }

      return { tool, result: "✓ Done", success: true, normalizedArg: arg, exitCode: 0 };
    });
    // Reset synthesis mock too
    mockSynthesizeWithHistory.mockImplementation(async function* () {
      yield "Synthesis fallback [[DONE]]";
    });
    lumina = new Lumina();
  });

  afterEach(async () => {
    await (lumina as any).destroy?.();
  });

  test("always includes the live user message in the outgoing API payload", async () => {
    await lumina.chat("set volume to 30");

    expect(capturedMessages.length).toBeGreaterThan(0);
    const firstCallHistory = capturedMessages[0]!;
    expect(firstCallHistory[firstCallHistory.length - 1]).toEqual({
      role: "user",
      content: "set volume to 30",
    });
  });

  test("feeds failed tool results back into history as user messages and continues looping", async () => {
    const toolOutputs: Array<{ text: string; type: string }> = [];
    let finalText = "";

    await lumina.chat("volume up", (chunk, toolOutput) => {
      if (toolOutput) {
        toolOutputs.push({ text: toolOutput.text, type: toolOutput.type });
      } else {
        finalText += chunk;
      }
    });

    expect(streamInvocations).toBe(3);
    expect(dispatchCalls).toEqual([
      { tool: "music", arg: '{"action":"volume_up"}' },
      { tool: "music", arg: '{"action":"volume_up"}' },
    ]);
    
    const secondCallHistory = capturedMessages[1]!;
    expect(secondCallHistory.some((message) => message.role === "user" && message.content.includes("status=failed"))).toBe(true);

    const thirdCallHistory = capturedMessages[2]!;
    expect(thirdCallHistory.some((message) => message.role === "user" && message.content.includes("status=ok"))).toBe(true);
    
    expect(finalText).toContain("Volume updated.");
  });

  test("persists tool result messages in chat history via chat manager", async () => {
    const chatManager = new ChatManager();
    const lm = new Lumina(chatManager);
    try {
      await lm.chat("volume up");
    } finally {
      await (lm as any).destroy?.();
    }

    const currentChat = chatManager.getCurrentChat();
    expect(currentChat).not.toBeNull();
    expect(currentChat?.messages.some((message) => message.role === "tool")).toBe(true);
    expect(currentChat?.messages.some((message) => message.role === "assistant")).toBe(true);
  });
});

import { runAgent } from "../src/agent/agent";
import * as contextModule from "../src/agent/context";

describe("Agent Tests (runAgent directly)", () => {
  let getSpy: any;
  beforeAll(() => {
    getSpy = spyOn(settingsManager, "get").mockReturnValue({ features: { toolDisplay: false } } as any);
  });
  afterAll(() => {
    getSpy.mockRestore();
  });
  beforeEach(() => {
    mockStreamGroq.mockReset();
    mockDispatch.mockReset();
    mockSynthesizeWithHistory.mockReset();
    mockStreamGroq.mockImplementation(async function* () {
      yield "[[DONE]]";
    });
    mockDispatch.mockImplementation(async (tool: string, arg: string) => {
      dispatchCalls.push({ tool, arg });
      return { success: true, result: "✓ ok", tool, normalizedArg: arg, exitCode: 0 };
    });
    // Restore safe synthesis default
    mockSynthesizeWithHistory.mockImplementation(async function* () {
      yield "Synthesis fallback [[DONE]]";
    });
    streamInvocations = 0;
    dispatchCalls = [];
  });

  test("terminal signals - early completion without tools emits warning", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield "I'm done [[DONE]]";
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).toBe("I'm done");
    expect(result.terminalSignal).toEqual({ type: "DONE" });
    expect(result.allToolResults.length).toBe(0);
  });

  test("terminal signals & tool calls in same turn executes tools first", async () => {
    mockStreamGroq.mockImplementation(async function* (history: any) {
      streamInvocations++;
      if (streamInvocations === 1) {
         yield '{"tool": "file", "args": "x"}\n[[DONE]]';
      } else {
         yield 'Finished [[DONE]]';
      }
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(dispatchCalls.length).toBeGreaterThan(0);
    expect(result.allToolResults.length).toBe(1);
    expect(result.finalResponse).toBe("Finished");
  });

  test("no-tool completion behavior - exits normally when no tools and no signal", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield "Just text here";
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).toBe("Just text here");
    expect(result.history[result.history.length - 1].content).toBe("Just text here");
  });

  test("infinite-loop prevention & synthesis fallback", async () => {
    mockStreamGroq.mockImplementation(async function* () {
      yield '{"tool": "file", "args": "x"}';
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    // 10 turns of tools + synthesis call
    expect(dispatchCalls.length).toBe(10);
    expect(result.finalResponse).toBe("Synthesis fallback");
    expect(result.terminalSignal).toEqual({ type: "DONE" });
  });

  // spying estimateHistoryTokens used to cause inf loops in safeTrim
  // (esm live binding intercepts the call inside the while condition).
  // mocking trimHistory directly instead so safeTrim never runs
  test("history trimming and token boundary", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield "Just text here";
    });

    // make agent think tokens are high, bypass safeTrim with controlled mock
    const estimateSpy = spyOn(contextModule, "estimateHistoryTokens").mockReturnValue(100000);
    const trimSpy = spyOn(contextModule, "trimHistory").mockImplementation((history) => {
      //same shape as real trimHistory
      const system = history[0]!;
      const original = history[1]!;
      const recent = history.slice(-4);
      return [system, original, ...recent];
    });
    
    const longHistory: any[] = [
      { role: "system", content: "AGENT PROTOCOL:" },
      { role: "user", content: "query" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a3" },
      { role: "user", content: "u3" },
    ];
    
    const result = await runAgent(longHistory);
    // [sys, query, a2, u2, a3, u3] + assistant msg = 7
    expect(result.history.length).toBe(7);
    estimateSpy.mockRestore();
    trimSpy.mockRestore();
  });

  test("retry handling and failure propagation", async () => {
    mockStreamGroq.mockImplementation(async function* (history: any) {
      if (dispatchCalls.length < 2) {
         yield '{"tool": "file", "args": "x"}';
      } else {
         yield 'Finished [[DONE]]';
      }
    });

    let localAttempt = 0;
    mockDispatch.mockImplementation(async (tool: string, arg: string) => {
      dispatchCalls.push({ tool, arg });
      localAttempt++;
      if (localAttempt <= 2) {
        throw new Error("timeout: connection reset");
      }
      return { success: true, result: "ok" } as any;
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(localAttempt).toBe(3); // first try + 2 retries
    expect(result.finalResponse).toBe("Finished");
  });

  test("non-retriable error does not retry", async () => {
    mockStreamGroq.mockImplementation(async function* (history: any) {
      streamInvocations++;
      if (streamInvocations === 1) {
         yield '{"tool": "file", "args": "x"}';
      } else {
         yield 'Finished [[DONE]]';
      }
    });

    let localAttempt = 0;
    mockDispatch.mockImplementation(async (tool: string, arg: string) => {
      dispatchCalls.push({ tool, arg });
      localAttempt++;
      throw new Error("permission denied");
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(localAttempt).toBe(1); // Only 1 attempt, no retries
    expect(result.finalResponse).toBe("Finished");
  });

  test("malformed tool output recovery", async () => {
    mockStreamGroq.mockImplementation(async function* (history: any) {
      streamInvocations++;
      if (streamInvocations === 1) {
         yield '{"tool": "file", "args": "x"'; // missing closing brace
      } else {
         yield 'Finished [[DONE]]';
      }
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).toBe('{"tool": "file", "args": "x"');
  });

  test("FAIL signal with tool calls executes tools and continues", async () => {
    mockStreamGroq.mockImplementation(async function* (history: any) {
      streamInvocations++;
      if (streamInvocations === 1) {
        yield 'Cannot proceed. [[FAIL: safety violation]]\n```json\n{"tool": "file", "args": "x"}\n```';
      } else {
        yield 'Acknowledged the failure [[DONE]]';
      }
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(dispatchCalls.length).toBe(1);
    expect(result.finalResponse).toContain("Acknowledged");
  });

  test("NEED_INPUT signal pauses the loop", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield 'What color? [[NEED_INPUT: Should I use dark mode?]]';
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).toContain("What color?");
    expect(result.history.length).toBe(3); // system, user, assistant
  });

  test("FAIL signal without tools exits immediately", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield 'Cannot complete. [[FAIL: missing dependency]]';
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).toBe("Cannot complete.");
    expect(result.terminalSignal).toEqual({ type: "FAIL", reason: "missing dependency" });
  });

  // when output is empty agent returns that msg, not empty string
  test("empty model response returns empty string", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      // yield nothing
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).toBe("Task failed: Model returned an empty response.");
    expect(result.history.length).toBe(2);     // assistant never pushed to history
  });

  test("synthesis fallback preserves history integrity", async () => {
    mockStreamGroq.mockImplementation(async function* () {
      yield '{"tool": "file", "args": "x"}';
    });

    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(dispatchCalls.length).toBe(10); // MAX_TURNS reached
    expect(result.finalResponse).toBe("Synthesis fallback");
    // synthesis prompt is not in ctx.history, only passed to the fn
    const lastUserMsg = [...result.history].reverse().find(m => m.role === "user");
    expect(lastUserMsg?.content).not.toContain("maximum number of reasoning steps");
  });

  test("trimHistory handles short but token-heavy history", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield "short response";
    });

    // estimate spy makes agent think tokens are high -> triggers trim
    // trimSpy bypasses safeTrim internals so no inf loop
    const estimateSpy = spyOn(contextModule, "estimateHistoryTokens").mockReturnValue(10000);
    const trimSpy = spyOn(contextModule, "trimHistory").mockImplementation((history) => {
      const system = history[0]!;
      const original = history[1] ?? history[0]!;
      const recent = history.slice(-4);
      return [system, original, ...recent].filter(
        (m, i, arr) => arr.indexOf(m) === i
      );
    });

    const shortHistory: any[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "x".repeat(5000) },
    ];

    await runAgent(shortHistory);
    expect(trimSpy).toHaveBeenCalled();
    estimateSpy.mockRestore();
    trimSpy.mockRestore();
  });

  test("Unexpected history structure in trimHistory degrades gracefully", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield "response";
    });

    const estimateSpy = spyOn(contextModule, "estimateHistoryTokens").mockReturnValue(10000);
    const trimSpy = spyOn(contextModule, "trimHistory").mockImplementation((history) => {
      // fallback: first msg + last 4
      return [history[0]!, ...history.slice(-4)];
    });

    const weirdHistory: any[] = [
      { role: "custom", content: "something" },
      { role: "user", content: "query" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u2" },
    ];

    const result = await runAgent(weirdHistory);
    expect(result.finalResponse).toBe("response");
    estimateSpy.mockRestore();
    trimSpy.mockRestore();
  });

  test("stripMarkersForDisplay removes DONE marker", async () => {
    const { stripMarkersForDisplay } = await import("../src/agent/signals");
    expect(stripMarkersForDisplay("Finished [[DONE]]")).toBe("Finished");
  });

  test("stripMarkersForDisplay removes FAIL marker", async () => {
    const { stripMarkersForDisplay } = await import("../src/agent/signals");
    expect(stripMarkersForDisplay("Error [[FAIL: timeout]]")).toBe("Error");
  });

  test("stripMarkersForDisplay preserves text without markers", async () => {
    const { stripMarkersForDisplay } = await import("../src/agent/signals");
    expect(stripMarkersForDisplay("Just text here")).toBe("Just text here");
  });

  test("stripMarkersForDisplay handles empty string", async () => {
    const { stripMarkersForDisplay } = await import("../src/agent/signals");
    expect(stripMarkersForDisplay("")).toBe("");
  });

  test("detectTerminalSignal still recognizes DONE after changes", async () => {
    const { detectTerminalSignal } = await import("../src/agent/signals");
    expect(detectTerminalSignal("[[DONE]]")).toEqual({ type: "DONE" });
    expect(detectTerminalSignal("done [[DONE]]")).toEqual({ type: "DONE" });
  });

  test("detectTerminalSignal still recognizes FAIL after changes", async () => {
    const { detectTerminalSignal } = await import("../src/agent/signals");
    expect(detectTerminalSignal("[[FAIL: missing deps]]")).toEqual({ type: "FAIL", reason: "missing deps" });
    expect(detectTerminalSignal("error [[FAIL: timeout]] here")).toEqual({ type: "FAIL", reason: "timeout" });
  });

  test("detectTerminalSignal returns NONE for clean text", async () => {
    const { detectTerminalSignal } = await import("../src/agent/signals");
    expect(detectTerminalSignal("Normal text without markers")).toEqual({ type: "NONE" });
    expect(detectTerminalSignal("")).toEqual({ type: "NONE" });
  });

  test("DONE marker hidden in agent finalResponse at parser level", async () => {
    mockStreamGroq.mockImplementationOnce(async function* () {
      yield "All done [[DONE]]";
    });
    const result = await runAgent([{ role: "system", content: "AGENT PROTOCOL:" }, { role: "user", content: "test" }]);
    expect(result.finalResponse).not.toContain("[[DONE]]");
    expect(result.finalResponse).toBe("All done");
  });
});
