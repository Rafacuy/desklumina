import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- Mocks (hoisted before imports) ---

const mockChat = mock(async (_: string, cb: (chunk: string, toolOutput?: any) => void) => {
  cb("response text");
});

const mockCurrentChat = {
  messages: [
    {
      role: "tool",
      content: "",
      toolResults: [
        {
          tool: "file",
          result: "search output",
          success: true,
          status: "search_complete",
          files: [{ path: "/tmp/example.txt", name: "example.txt", directory: "/tmp", type: "file", hidden: false }],
          selectedFile: "/tmp/example.txt",
          actions: ["locate:name", "filter_results"],
          summary: { mode: "name", query: "example", totalMatches: 1, filteredMatches: 1, returnedMatches: 1 },
        },
      ],
    },
  ],
};

mock.module("../src/core", () => ({
  Lumina: class {
    chat = mockChat;
  },
  ChatManager: class {
    createChat = mock(() => ({ id: "test-id" }));
    addMessage = mock(() => {});
    getCurrentChat = mock(() => mockCurrentChat);
  },
}));

mock.module("../src/logger", () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  },
}));

mock.module("../src/utils", () => ({ t: (s: string) => s }));
mock.module("../src/config/env", () => ({ env: {} }));

import { DeskLuminaDaemon } from "../src/daemon/daemon";

// ---------------------------------------------------------------------------

describe("DeskLuminaDaemon", () => {
  const socketPath = join(homedir(), ".config/desklumina/daemon.sock");

  let daemon: DeskLuminaDaemon;
  let serveSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;
  let capturedFetch: ((req: Request) => Promise<Response>) | null = null;

  beforeEach(() => {
    capturedFetch = null;

    serveSpy = spyOn(Bun, "serve").mockImplementation((opts: any) => {
      capturedFetch = opts.fetch;
      return { stop: mock(() => {}), port: 0 } as any;
    });

    exitSpy = spyOn(process, "exit").mockImplementation((() => {}) as any);

    daemon = new DeskLuminaDaemon();
  });

  afterEach(() => {
    serveSpy.mockRestore();
    exitSpy.mockRestore();
    mockChat.mockReset();
    mockChat.mockImplementation(async (_: string, cb: (chunk: string, toolOutput?: any) => void) => {
      cb("response text");
    });
    if (existsSync(socketPath)) unlinkSync(socketPath);
  });

  // --- Initial state ---

  test("isActive returns false before start", () => {
    expect(daemon.isActive()).toBe(false);
  });

  test("getSocketPath returns correct unix socket path", () => {
    expect(daemon.getSocketPath()).toBe(socketPath);
    expect(daemon.getSocketPath()).toContain("daemon.sock");
  });

  // --- start() ---

  test("start sets isActive to true", async () => {
    await daemon.start();
    expect(daemon.isActive()).toBe(true);
  });

  test("start calls Bun.serve with unix socket path", async () => {
    await daemon.start();
    expect(serveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ unix: socketPath })
    );
  });

  test("start removes existing socket file before binding", async () => {
    writeFileSync(socketPath, "stale");
    expect(existsSync(socketPath)).toBe(true);
    await daemon.start();
    // unlinkSync removes it before Bun.serve is called
    expect(serveSpy).toHaveBeenCalled();
  });

  test("start does not call Bun.serve if already running", async () => {
    await daemon.start();
    serveSpy.mockClear();
    await daemon.start();
    expect(serveSpy).not.toHaveBeenCalled();
  });

  // --- stop() ---

  test("stop does nothing if daemon is not running", async () => {
    await daemon.stop();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test("stop sets isActive to false", async () => {
    await daemon.start();
    await daemon.stop();
    expect(daemon.isActive()).toBe(false);
  });

  test("stop calls process.exit(0) on clean shutdown", async () => {
    await daemon.start();
    await daemon.stop();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("stop removes socket file", async () => {
    await daemon.start();
    writeFileSync(socketPath, "");
    await daemon.stop();
    expect(existsSync(socketPath)).toBe(false);
  });

  // --- HTTP fetch handler ---

  describe("fetch handler", () => {
    beforeEach(async () => {
      await daemon.start();
    });

    test("returns 400 when cmd param is missing", async () => {
      const res = await capturedFetch!(new Request("http://localhost/"));
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body).toHaveProperty("error", "Missing command");
    });

    test("returns 200 with success on valid command", async () => {
      const res = await capturedFetch!(new Request("http://localhost/?cmd=open+telegram"));
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body).toHaveProperty("success", true);
      expect(body).toHaveProperty("response");
    });

    test("response has application/json Content-Type", async () => {
      const res = await capturedFetch!(new Request("http://localhost/?cmd=test"));
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    test("strips json code blocks from AI response", async () => {
      mockChat.mockImplementationOnce(async (_: string, cb: (chunk: string, toolOutput?: any) => void) => {
        cb('Done!\n```json\n{"tool":"app","args":"telegram"}\n```');
      });
      const res = await capturedFetch!(new Request("http://localhost/?cmd=open+telegram"));
      const body = await res.json() as any;
      expect(body.response).not.toContain("```json");
    });

    test("returns 'Done.' when response is empty after cleaning", async () => {
      mockChat.mockImplementationOnce(async (_: string, cb: (chunk: string, toolOutput?: any) => void) => {
        cb('```json\n{"tool":"app","args":"telegram"}\n```');
      });
      const res = await capturedFetch!(new Request("http://localhost/?cmd=open+telegram"));
      const body = await res.json() as any;
      expect(body.response).toBe("Done.");
    });

    test("includes structured callback fields while preserving response", async () => {
      mockChat.mockImplementationOnce(async (_: string, cb: (chunk: string, toolOutput?: any) => void) => {
        cb("response text");
        cb("", { type: "results", text: "tool callback output", results: mockCurrentChat.messages[0].toolResults });
      });
      const res = await capturedFetch!(new Request("http://localhost/?cmd=file+search"));
      const body = await res.json() as any;
      expect(body.response).toBe("response text");
      expect(body.status).toBe("search_complete");
      expect(body.callback).toContain("tool callback output");
      expect(body.callbackEvents[0].type).toBe("results");
      expect(body.files[0].path).toBe("/tmp/example.txt");
      expect(body.selectedFile).toBe("/tmp/example.txt");
      expect(body.actions).toContain("filter_results");
    });

    test("returns 500 when lumina.chat throws", async () => {
      mockChat.mockImplementationOnce(async () => {
        throw new Error("API failure");
      });
      const res = await capturedFetch!(new Request("http://localhost/?cmd=crash"));
      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body).toHaveProperty("error", "API failure");
    });
  });
});
