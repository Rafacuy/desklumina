import { validateOrExit } from "../config/env";
import { DeskLuminaDaemon } from "./daemon";
import { t } from "../utils";

export async function daemonMain(): Promise<void> {
  validateOrExit();

  console.log(t("daemon.starting"));
  const daemon = new DeskLuminaDaemon();
  await daemon.start();
  console.log(t("daemon.started_success"));
  console.log(t("daemon.send_usage"));

  process.stdin.resume();
}
