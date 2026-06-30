import { logger } from "../logger";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export class DaemonClient {
  private socketPath: string;
  private tokenPath: string;
  private pidPath: string;
  private cachedToken: string | null = null;
  private cachedPid: number | null = null;

  constructor() {
    const runtimeDir = Bun.env.XDG_RUNTIME_DIR || join(Bun.env.HOME!, ".config/desklumina");
    this.socketPath = join(runtimeDir, "desklumina.sock");
    this.tokenPath = join(Bun.env.HOME!, ".config/desklumina/.daemon-token");
    this.pidPath = join(runtimeDir, "desklumina.pid");
  }

  private getToken(): string | null {
    if (this.cachedToken) return this.cachedToken;
    try {
      if (existsSync(this.tokenPath)) {
        this.cachedToken = readFileSync(this.tokenPath, "utf8").trim();
        this.cachedPid = this.readPid();
        return this.cachedToken;
      }
    } catch (err) {
      logger.error("daemon-client", `Failed to read token: ${err}`);
    }
    return null;
  }

  private readPid(): number | null {
    try {
      if (!existsSync(this.pidPath)) return null;
      const raw = readFileSync(this.pidPath, "utf-8").trim();
      const pid = Number(raw);
      if (!Number.isInteger(pid) || pid <= 0) return null;
      return pid;
    } catch {
      return null;
    }
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async sendCommand(command: string): Promise<string> {
    if (!(await this.isDaemonRunning())) {
      throw new Error("Daemon is not running. Start it with: bun run daemon");
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
      } as RequestInit & { unix: string });
      const data = await response.json() as { success?: boolean; response?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data.response || "No response";
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("daemon-client", `Failed to send command: ${err.message}`, err);
      this.cachedToken = null;
      this.cachedPid = null;
      throw err;
    }
  }

  async isDaemonRunning(): Promise<boolean> {
    if (!existsSync(this.socketPath)) {
      return false;
    }

    const pid = this.readPid();
    if (pid !== null && this.isPidAlive(pid)) {
      if (this.cachedPid !== null && pid !== this.cachedPid) {
        this.cachedToken = null;
      }
      return true;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      const response = await fetch("http://localhost/health", {
        unix: this.socketPath,
        signal: controller.signal,
      } as RequestInit & { unix: string });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getThemePath(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch("http://localhost/v1/theme/default", {
        unix: this.socketPath,
        headers: { "Authorization": `Bearer ${token}` },
      } as RequestInit & { unix: string });

      if (!response.ok) return null;
      const data = await response.json() as { path?: string };
      return data.path ?? null;
    } catch {
      return null;
    }
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}

export { DeskLuminaDaemon } from "./daemon";
