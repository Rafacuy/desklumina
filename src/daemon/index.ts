import { DeskLuminaDaemon } from "./daemon";
import { logger } from "../logger";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export class DaemonClient {
  private socketPath: string;
  private tokenPath: string;

  constructor() {
    this.socketPath = join(homedir(), ".config/desklumina/daemon.sock");
    this.tokenPath = join(homedir(), ".config/desklumina/.daemon-token");
  }

  private getToken(): string | null {
    try {
      if (existsSync(this.tokenPath)) {
        return readFileSync(this.tokenPath, "utf8").trim();
      }
    } catch (err) {
      logger.error("daemon-client", `Failed to read token: ${err}`);
    }
    return null;
  }

  async sendCommand(command: string): Promise<string> {
    if (!(await this.isDaemonRunning())) {
      throw new Error("Daemon is not running. Start it with: lumina --daemon");
    }

    const token = this.getToken();
    if (!token) {
      throw new Error("Daemon token not found. Please restart the daemon.");
    }

    try {
      const response = await fetch(`http://localhost/?cmd=${encodeURIComponent(command)}`, {
        unix: this.socketPath,
        headers: {
          "Authorization": `Bearer ${token}`
        }
      } as any);
      const data = await response.json() as { success?: boolean; response?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data.response || "No response";
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon-client", `Failed to send command: ${err.message}`, err);
      throw err;
    }
  }

  async isDaemonRunning(): Promise<boolean> {
    if (!existsSync(this.socketPath)) {
      return false;
    }

    try {
      // Perform health check to ensure it's not a stale socket
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      const response = await fetch("http://localhost/health", {
        unix: this.socketPath,
        signal: controller.signal,
      } as any);

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}

export { DeskLuminaDaemon };
