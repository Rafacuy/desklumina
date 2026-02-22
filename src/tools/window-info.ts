import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ActiveWindowInfo {
  pid: number;
  windowId: string;
  className: string;
  title: string;
  processName: string;
}

export async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  try {
    // Get focused window ID
    const { stdout: windowId } = await execAsync("bspc query -N -n focused");
    const wid = windowId.trim();
    
    if (!wid) return null;

    // Get window info using xprop
    const { stdout: xpropOutput } = await execAsync(`xprop -id ${wid}`);
    
    // Parse PID
    const pidMatch = xpropOutput.match(/_NET_WM_PID\(CARDINAL\) = (\d+)/);
    const pid = pidMatch?.[1] ? parseInt(pidMatch[1]) : 0;
    
    // Parse class name
    const classMatch = xpropOutput.match(/WM_CLASS\(STRING\) = "([^"]+)", "([^"]+)"/);
    const className = classMatch?.[2] ?? "Unknown";
    
    // Parse window title
    const titleMatch = xpropOutput.match(/_NET_WM_NAME\(UTF8_STRING\) = "([^"]+)"/);
    const title = titleMatch?.[1] ?? "Unknown";
    
    // Get process name from PID
    let processName = className;
    if (pid > 0) {
      try {
        const { stdout: cmdline } = await execAsync(`cat /proc/${pid}/comm`);
        processName = cmdline.trim();
      } catch {}
    }

    return {
      pid,
      windowId: wid,
      className,
      title,
      processName,
    };
  } catch (error) {
    return null;
  }
}

export function formatWindowContext(info: ActiveWindowInfo | null): string {
  if (!info) return "";
  
  return `
== APLIKASI AKTIF ==
- Aplikasi: ${info.className}
- Proses: ${info.processName} (PID: ${info.pid})
- Window: ${info.title}
- Window ID: ${info.windowId}
`;
}
