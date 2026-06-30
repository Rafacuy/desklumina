#!/usr/bin/env bun
import { daemonMain } from "./daemon/main";
daemonMain().catch(console.error);
