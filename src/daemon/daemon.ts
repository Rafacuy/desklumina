import { t } from "../utils";
import { Lumina, ChatManager } from "../core";
import { logger } from "../logger";
import { env } from "../config/env";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export class DeskLuminaDaemon {
  private lumina: Lumina;
  private chatManager: ChatManager;
  private isRunning = false;
  private socketPath: string;
  private server?: any;

  constructor() {
    this.chatManager = new ChatManager();
    this.lumina = new Lumina(this.chatManager);
    this.socketPath = join(homedir(), ".config/desklumina/daemon.sock");
    this.ensureSocketDir();
  }

  private ensureSocketDir(): void {
    const socketDir = join(homedir(), ".config/desklumina");
    if (!existsSync(socketDir)) {
      mkdirSync(socketDir, { recursive: true });
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("daemon", t("Daemon already running"));
      return;
    }

    try {
      // Clean up existing socket
      if (existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
      }

      this.server = Bun.serve({
        unix: this.socketPath,
        fetch: async (req) => {
          try {
            const url = new URL(req.url);
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
            await this.lumina.chat(command, (chunk) => {
              response += chunk;
            });

            // Clean response for daemon usage
            const cleanResponse = response
              .replace(/```json\s*\n[\s\S]*?\n```/g, "")
              .replace(/<tool:\w+>.*?<\/tool:\w+>/gs, "")
              .trim() || "Done.";

            return new Response(JSON.stringify({ 
              success: true, 
              response: cleanResponse 
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

      this.isRunning = true;
      logger.info("daemon", t(`Daemon started on ${this.socketPath}`));
      
      // Handle graceful shutdown
      process.on("SIGINT", () => this.stop());
      process.on("SIGTERM", () => this.stop());

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
      if (this.server) {
        this.server.stop();
      }
      
      if (existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
      }

      this.isRunning = false;
      logger.info("daemon", t("Daemon stopped"));
      process.exit(0);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon", `Error stopping daemon: ${err.message}`, err);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}
