import { DaemonClient } from "../daemon";

let cachedClient: DaemonClient | null = null;

export function getDaemonClient(): DaemonClient {
  if (!cachedClient) {
    cachedClient = new DaemonClient();
  }
  return cachedClient;
}

export async function isDaemonAvailable(): Promise<boolean> {
  try {
    return await getDaemonClient().isDaemonRunning();
  } catch {
    return false;
  }
}
