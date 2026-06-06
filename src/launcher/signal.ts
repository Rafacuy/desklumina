import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const runtimeDir = process.env.XDG_RUNTIME_DIR || join(homedir(), ".config/desklumina");
const PID_PATH = join(runtimeDir, "desklumina.pid");

export function readDaemonPid(): number | null {
  try {
    if (!existsSync(PID_PATH)) return null;
    const raw = readFileSync(PID_PATH, "utf-8").trim();
    const pid = Number(raw);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    return pid;
  } catch {
    return null;
  }
}

export function fireFastPathSignal(pid: number): boolean {
  try {
    process.kill(pid, "SIGUSR1");
    return true;
  } catch {
    return false;
  }
}

export function probeDaemonPid(): number | null {
  const pid = readDaemonPid();
  if (pid === null) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}
