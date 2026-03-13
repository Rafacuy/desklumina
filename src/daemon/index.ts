import { DeskLuminaDaemon } from "./daemon";
import { logger } from "../logger";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export class DaemonClient {
  private socketPath: string;

  constructor() {
    this.socketPath = join(homedir(), ".config/bspwm/agent/daemon.sock");
  }

  async sendCommand(command: string): Promise<string> {
    if (!this.isDaemonRunning()) {
      throw new Error("Daemon is not running. Start it with: lumina --daemon");
    }

    try {
      const response = await fetch(`http://unix:${this.socketPath}?cmd=${encodeURIComponent(command)}`);
      const data = await response.json() as { success?: boolean; response?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data.response || "No response";
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon-client", `Failed to send command: ${err.message}`, err);
      throw err;
    }
  }

  isDaemonRunning(): boolean {
    return existsSync(this.socketPath);
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}

export { DeskLuminaDaemon };
