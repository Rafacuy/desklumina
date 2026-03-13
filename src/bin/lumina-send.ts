#!/usr/bin/env bun
import { DaemonClient } from "../daemon";
import { logger } from "../logger";

async function main() {
  const args = process.argv.slice(2);
  const command = args.join(" ");

  if (!command) {
    console.error("Usage: lumina-send <command>");
    process.exit(1);
  }

  const client = new DaemonClient();

  try {
    const response = await client.sendCommand(command);
    console.log(response);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.fatal("lumina-send", error.message);
});
