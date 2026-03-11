import { execute } from "./terminal";
import { logger } from "../logger";
import { checkDangerousCommand } from "../security/dangerous-commands";
import { rofiConfirm } from "../security/confirmation";

const BSPWM_ACTIONS: Record<string, string> = {
  focus_workspace: "bspc desktop -f",
  move_window_to: "bspc node -d",
  close_focused: "bspc node -c",
  kill_focused: "bspc node -k",
  toggle_fullscreen: "bspc node -t fullscreen",
  toggle_floating: "bspc node -t floating",
  toggle_monocle: "bspc desktop -l monocle",
  focus_north: "bspc node -f north",
  focus_south: "bspc node -f south",
  focus_east: "bspc node -f east",
  focus_west: "bspc node -f west",
  rotate_desktop: "bspc node @/ -R 90",
  list_windows: "bspc query -N -d",
  get_focused_window: "bspc query -N -n focused",
  reload_sxhkd: "pkill -USR1 sxhkd",
  reload_bspwm: "bspc wm -r",
  list_workspaces: "bspc query -D --names",
};

/**
 * Wait for a window with specific class to appear
 */
async function waitForWindow(className: string, timeoutMs: number = 5000): Promise<string | null> {
  const start = Date.now();
  // Try both class and instance name
  while (Date.now() - start < timeoutMs) {
    const { stdout } = await execute(`bspc query -N -n .${className}.window || bspc query -N -n .${className.toLowerCase()}.window`);
    if (stdout.trim()) {
      const lines = stdout.trim().split("\n");
      return lines[0] ?? null;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return null;
}

/**
 * Execute BSPWM action
 */
export async function bspwm(action: string): Promise<string> {
  logger.info("bspwm", `Aksi: ${action}`);

  try {
    const parts = action.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Special handling for wait_and_move
    if (cmd === "wait_and_move" && args.length >= 2) {
      const [className, targetWorkspace] = args;
      if (!className || !targetWorkspace) {
        return "❌ Parameter tidak lengkap untuk wait_and_move";
      }
      const wid = await waitForWindow(className);
      if (!wid) return `❌ Gagal: Window "${className}" tidak muncul dalam 5 detik`;

      const workspaceSelector = /^\d+$/.test(targetWorkspace) ? `^${targetWorkspace}` : targetWorkspace;
      const moveCmd = `bspc node ${wid} -d ${workspaceSelector}`;
      const result = await execute(moveCmd);
      if (result.exitCode !== 0) {
        return `❌ Gagal memindahkan window: ${result.stderr}`;
      }
      return `✓ ${className} dipindah ke workspace ${targetWorkspace}`;
    }

    const baseCommand = cmd ? BSPWM_ACTIONS[cmd] : undefined;
    let command = "";

    if (baseCommand) {
      if (cmd === "move_window_to" && args.length >= 1) {
        const workspace = args[args.length - 1];
        const selector = args.length > 1 ? args[0] : null;
        if (!workspace) {
          return "❌ Workspace tidak ditentukan";
        }
        const workspaceSelector = /^\d+$/.test(workspace) ? `^${workspace}` : workspace;
        
        if (!selector || selector === "focused") {
          command = `bspc node -d ${workspaceSelector}`;
        } else {
          const nodeSelector = (selector.startsWith(".") || selector.startsWith("#") || /^[0-9x]+$/.test(selector)) 
            ? selector 
            : `.${selector}.window`;
          command = `bspc node ${nodeSelector} -d ${workspaceSelector}`;
        }
      } else if (cmd === "focus_workspace" && args.length >= 1) {
        const workspace = args[0];
        if (!workspace) {
          return "❌ Workspace tidak ditentukan";
        }
        const workspaceSelector = /^\d+$/.test(workspace) ? `^${workspace}` : workspace;
        command = `bspc desktop -f ${workspaceSelector}`;
      } else if (args.length > 0) {
        command = `${baseCommand} ${args.join(" ")}`;
      } else {
        command = baseCommand;
      }
    } else {
      command = action;
    }

    const dangerous = checkDangerousCommand(command);
    if (dangerous) {
      const confirmed = await rofiConfirm(
        `${dangerous.description}`,
        `Perintah: ${command}\n\nTingkat Bahaya: ${dangerous.severity.toUpperCase()}`,
        dangerous.severity
      );

      if (!confirmed) {
        logger.info("bspwm", `Perintah berbahaya dibatalkan pengguna`);
        return "Operasi dibatalkan pengguna";
      }
    }

    const result = await execute(command);
    if (result.exitCode !== 0) {
      logger.warn("bspwm", `Command failed: ${result.stderr}`);
      return `❌ Error: ${result.stderr || "Perintah gagal"}`;
    }
    
    return result.stdout || "✓ Selesai";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("bspwm", `BSPWM operation failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}

/**
 * Get list of available BSPWM actions
 */
export function getAvailableActions(): string[] {
  return [...Object.keys(BSPWM_ACTIONS), "wait_and_move"];
}
