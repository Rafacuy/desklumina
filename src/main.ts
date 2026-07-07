#!/usr/bin/env bun

const args = Bun.argv.slice(2);

async function main() {
  const { launcherMain } = await import("./launcher/main");
  return launcherMain(args);
}

main().catch(async (error) => {
  const { logger } = await import("./logger");
  logger.fatal("main", error instanceof Error ? error.message : String(error));
});
