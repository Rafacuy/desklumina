#!/usr/bin/env bun
import { launcherMain } from "./launcher/main";
launcherMain(Bun.argv.slice(2)).catch(console.error);
