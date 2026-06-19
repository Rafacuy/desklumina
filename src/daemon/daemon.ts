import { t, tf, cleanAssistantResponse } from "../utils";
import { Lumina, ChatManager } from "../core";
import { logger } from "../logger";
import { existsSync, mkdirSync, unlinkSync, chmodSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
import { CacheManager } from "./cache/cache-manager";
import { startFileWatcher, stopFileWatcher } from "./cache/file-watcher";
import { AsyncMutex } from "../utils/async-mutex";
import { initializeLtm, closeLtmStore } from "../ltm";
import { resultStore } from "../tools/result-store";
import type { ToolCallbackPayload } from "../types";

type DaemonState = "idle" | "binding" | "warming" | "ready" | "draining" | "flushing" | "closing";

const MAX_INFLIGHT = 1; // writeLock serializes all commands
const DRAIN_TIMEOUT_MS = 5000;
const MAX_COMMAND_LENGTH = 8192;

export class DeskLuminaDaemon {
  private lumina!: Lumina;
  private chatManager!: ChatManager;
  private state: DaemonState = "idle";
  private socketPath: string;
  private tokenPath: string;
  private pidPath: string;
  private server?: ReturnType<typeof Bun.serve>;
  private token?: string;
  private cacheManager = new CacheManager();
  private writeLock = new AsyncMutex();
  private inflightCount = 0;
  private startTime = 0;
  private lastWarmupAt = 0;

  constructor() {
    const runtimeDir = process.env.XDG_RUNTIME_DIR || join(homedir(), ".config/desklumina");
    this.socketPath = join(runtimeDir, "desklumina.sock");
    this.tokenPath = join(homedir(), ".config/desklumina/.daemon-token");
    this.pidPath = join(runtimeDir, "desklumina.pid");
    this.ensureSocketDir();
  }

  private ensureSocketDir(): void {
    const socketDir = this.socketPath.split("/").slice(0, -1).join("/");
    if (!existsSync(socketDir)) {
      mkdirSync(socketDir, { recursive: true });
    }
  }

  private generateToken(): string {
    const token = randomUUID();
    writeFileSync(this.tokenPath, token, { mode: 0o600 });
    this.token = token;
    return token;
  }

  async start(): Promise<void> {
    if (this.state !== "idle") {
      logger.warn("daemon", "Daemon already running");
      return;
    }

    try {
      this.state = "binding";
      this.generateToken();

      if (existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
      }

      this.server = Bun.serve({
        unix: this.socketPath,
        fetch: async (req) => this.handleFetch(req),
      });

      if (existsSync(this.socketPath)) {
        chmodSync(this.socketPath, 0o600);
      }

      writeFileSync(this.pidPath, String(process.pid), { mode: 0o600 });

      this.state = "warming";
      this.chatManager = new ChatManager();
      this.lumina = new Lumina(this.chatManager);
      await this.cacheManager.warmup();

      initializeLtm();
      startFileWatcher(this.cacheManager);
      this.installSignalHandlers();

      this.state = "ready";
      this.startTime = Date.now();
      logger.info("daemon", tf("daemon.started", { path: this.socketPath }));

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon", `Failed to start daemon: ${err.message}`, err);
      this.state = "idle";
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.state === "idle") return;

    try {
      this.state = "draining";
      const drainStart = Date.now();
      while (this.inflightCount > 0 && Date.now() - drainStart < DRAIN_TIMEOUT_MS) {
        await Bun.sleep(50);
      }

      this.state = "flushing";
      stopFileWatcher();
      closeLtmStore();
      await resultStore.shutdown();

      this.state = "closing";
      if (this.server) {
        this.server.stop();
        logger.info("daemon", "Server stopped");
      }

      if (existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
      }
      if (existsSync(this.tokenPath)) {
        unlinkSync(this.tokenPath);
      }
      if (existsSync(this.pidPath)) {
        unlinkSync(this.pidPath);
      }

      this.state = "idle";
      logger.info("daemon", "Daemon stopped");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon", `Error stopping daemon: ${err.message}`, err);
    }
  }

  private installSignalHandlers(): void {
    process.on("SIGUSR1", () => {
      if (Date.now() - this.lastWarmupAt > 5000) {
        this.cacheManager.warmupHotCaches().catch(err =>
          logger.warn("daemon", `warmup failed: ${err}`)
        );
        this.lastWarmupAt = Date.now();
      }
    });

    process.on("SIGINT", async () => {
      logger.info("daemon", "Received SIGINT, stopping...");
      await this.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("daemon", "Received SIGTERM, stopping...");
      await this.stop();
      process.exit(0);
    });

    process.on("uncaughtException", (err) => {
      logger.error("daemon", `Uncaught exception: ${err.message}`, err);
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("daemon", `Unhandled rejection: ${reason}`);
    });
  }

  private async handleFetch(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);

      if (url.pathname === "/health" || url.pathname === "/v1/healthz") {
        return this.handleHealthz();
      }

      if (url.pathname === "/v1/diag") {
        return new Response(JSON.stringify(this.cacheManager.diag()), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/v1/theme/default" || url.pathname === "/v1/theme") {
        return this.handleGetTheme();
      }

      if (this.inflightCount >= MAX_INFLIGHT) {
        return new Response("busy", {
          status: 503,
          headers: { "Retry-After": "1" },
        });
      }

      const authHeader = req.headers.get("Authorization");
      if (authHeader !== `Bearer ${this.token}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      let command: string | null = null;

      if (url.pathname === "/v1/command" && req.method === "POST") {
        const body = await req.json() as { cmd?: string };
        command = body.cmd ?? null;
      } else {
        command = url.searchParams.get("cmd");
      }

      if (!command) {
        return new Response(JSON.stringify({ error: "Missing command" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (command.length > MAX_COMMAND_LENGTH) {
        return new Response(JSON.stringify({ error: "Command too long" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      this.inflightCount++;
      try {
        return await this.executeCommand(command);
      } finally {
        this.inflightCount--;
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon", `Request error: ${err.message}`, err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  private handleHealthz(): Response {
    const uptime = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const payload = `OK\n${process.pid}\n${uptime}\n`;
    return new Response(payload, { status: 200 });
  }

  private async handleGetTheme(): Promise<Response> {
    try {
      const themePath = await this.cacheManager.theme.getOrLoad();
      return new Response(JSON.stringify({ path: themePath }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  }

  private async executeCommand(command: string): Promise<Response> {
    logger.info("daemon", `Processing command: ${command}`);

    return this.writeLock.runExclusive(async () => {
      this.chatManager.createChat(command);

      let response = "";
      let callback = "";
      const callbackEvents: ToolCallbackPayload[] = [];
      await this.lumina.chat(command, (chunk, callbackOutput) => {
        if (callbackOutput) {
          callbackEvents.push(callbackOutput);
          callback += callbackOutput.text;
        } else {
          response += chunk;
        }
      });

      const cleanResponse = cleanAssistantResponse(response) || "Done.";

      const currentChat = this.chatManager.getCurrentChat();
      const toolResults = currentChat?.messages
        .filter((message) => message.role === "tool")
        .flatMap((message) => message.toolResults || []) || [];
      const fileResults = toolResults.filter((result) => result.tool === "file");
      const files = fileResults.flatMap((result) => result.extra?.files || []);
      const selectedFile = fileResults.map((result) => result.extra?.selectedFile).find(Boolean);
      const actions = fileResults.flatMap((result) => result.actions || []);
      const summary = fileResults.map((result) => result.extra?.summary).find(Boolean) || undefined;
      const status = fileResults.map((result) => result.status).find(Boolean) || "completed";

      return new Response(JSON.stringify({
        success: true,
        response: cleanResponse,
        status,
        callback: callback.trim(),
        callbackEvents,
        toolResults,
        files,
        selectedFile,
        actions,
        summary,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  isActive(): boolean {
    return this.state === "ready";
  }

  getState(): DaemonState {
    return this.state;
  }

  getSocketPath(): string {
    return this.socketPath;
  }

  getCacheManager(): CacheManager {
    return this.cacheManager;
  }
}
