import { execute } from "./terminal";
import { logger } from "../logger";
import { checkDangerousCommand } from "../security/dangerous-commands";
import { rofiConfirm } from "../security/confirmation";

export async function bspwm(action: string): Promise<string> {
  logger.info("bspwm", `Aksi: ${action}`);

  const parts = action.trim().split(/\s+/);
  const cmd = parts[0];
  const arg = parts[1];

  const actions: Record<string, string> = {
    focus_workspace: `bspc desktop -f ^${arg}`,
    move_window_to: `bspc node -d ^${arg}`,
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
    list_workspaces: "bspc query -D",
  };

  const command = actions[cmd] || action;

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
  return result.stdout || "Selesai";
}
