import { t, cleanAssistantResponse } from "../utils";
import { Lumina, ChatManager } from "../core";
import { logger } from "../logger";
import { env } from "../config/env";
import { existsSync, mkdirSync, unlinkSync, chmodSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { randomUUID } from "crypto";
import type { ToolCallbackPayload } from "../types";

export class DeskLuminaDaemon {
  private lumina: Lumina;
  private chatManager: ChatManager;
  private isRunning = false;
  private socketPath: string;
  private tokenPath: string;
  private server?: any;
  private token?: string;

  constructor() {
    this.chatManager = new ChatManager();
    this.lumina = new Lumina(this.chatManager);
    this.socketPath = join(homedir(), ".config/desklumina/daemon.sock");
    this.tokenPath = join(homedir(), ".config/desklumina/.daemon-token");
    this.ensureSocketDir();
  }

  private ensureSocketDir(): void {
    const socketDir = join(homedir(), ".config/desklumina");
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
    if (this.isRunning) {
      logger.warn("daemon", t("Daemon already running"));
      return;
    }

    try {
      // Generate new token for this session
      this.generateToken();

      // Clean up existing socket
      if (existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
      }

      this.server = Bun.serve({
        unix: this.socketPath,
        fetch: async (req) => {
          try {
            const url = new URL(req.url);

            // Health check endpoint (no auth needed for health check from localhost)
            if (url.pathname === "/health") {
              return new Response(JSON.stringify({ status: "ok" }), {
                headers: { "Content-Type": "application/json" }
              });
            }

            // Authentication check
            const authHeader = req.headers.get("Authorization");
            if (authHeader !== `Bearer ${this.token}`) {
              return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              });
            }

            const command = url.searchParams.get("cmd");
            
            if (!command) {
              return new Response(JSON.stringify({ error: "Missing command" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
              });
            }

            logger.info("daemon", `Processing command: ${command}`);
            
            // Create new chat for each command
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

            // Clean response for daemon usage
            const cleanResponse = cleanAssistantResponse(response) || "Done.";

            const currentChat = this.chatManager.getCurrentChat();
            const toolResults = currentChat?.messages
              .filter((message) => message.role === "tool")
              .flatMap((message) => message.toolResults || []) || [];
            const fileResults = toolResults.filter((result) => result.tool === "file");
            const files = fileResults.flatMap((result) => result.files || []);
            const selectedFile = fileResults.map((result) => result.selectedFile).find(Boolean);
            const actions = fileResults.flatMap((result) => result.actions || []);
            const summary = fileResults.map((result) => result.summary).find(Boolean) || undefined;
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
              headers: { "Content-Type": "application/json" }
            });

          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.error("daemon", `Request error: ${err.message}`, err);
            
            return new Response(JSON.stringify({ 
              error: err.message 
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
      });

      // Set restrictive permissions on the socket file
      if (existsSync(this.socketPath)) {
        chmodSync(this.socketPath, 0o600);
      }

      this.isRunning = true;
      logger.info("daemon", t(`Daemon started on ${this.socketPath}`));
      
      // Handle graceful shutdown
      process.on("SIGINT", async () => {
        logger.info("daemon", "Received SIGINT, stopping...");
        await this.stop();
      });
      process.on("SIGTERM", async () => {
        logger.info("daemon", "Received SIGTERM, stopping...");
        await this.stop();
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon", `Failed to start daemon: ${err.message}`, err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;
      
      if (this.server) {
        this.server.stop();
        logger.info("daemon", "Server stopped");
      }
      
      if (existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
        logger.info("daemon", "Socket file removed");
      }

      if (existsSync(this.tokenPath)) {
        unlinkSync(this.tokenPath);
        logger.info("daemon", "Token file removed");
      }

      logger.info("daemon", t("Daemon stopped"));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon", `Error stopping daemon: ${err.message}`, err);
    } finally {
      process.exit(0);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}
