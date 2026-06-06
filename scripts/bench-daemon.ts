#!/usr/bin/env bun
import { spawn } from "bun";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const RUNS = 20;
const runtimeDir = process.env.XDG_RUNTIME_DIR || join(homedir(), ".config/desklumina");
const SOCK_PATH = join(runtimeDir, "desklumina.sock");
const PID_PATH = join(runtimeDir, "desklumina.pid");

async function measureDaemonBoot(): Promise<number[]> {
  const times: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    if (existsSync(SOCK_PATH)) unlinkSync(SOCK_PATH);
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);

    const start = performance.now();
    const proc = spawn(["bun", "run", "src/main.ts", "--daemon"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    let elapsed = 0;
    for (let wait = 0; wait < 5000; wait += 50) {
      await Bun.sleep(50);
      if (existsSync(SOCK_PATH) && existsSync(PID_PATH)) {
        elapsed = performance.now() - start;
        break;
      }
    }

    times.push(elapsed);
    proc.kill("SIGTERM");
    await proc.exited.catch(() => {});
    await Bun.sleep(200);
  }

  return times;
}

function stats(times: number[]): { p50: number; p95: number; p99: number; avg: number; stddev: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const variance = sorted.reduce((sum, v) => sum + (v - avg) ** 2, 0) / sorted.length;
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)]!,
    p95: sorted[Math.floor(sorted.length * 0.95)]!,
    p99: sorted[Math.floor(sorted.length * 0.99)]!,
    avg,
    stddev: Math.sqrt(variance),
  };
}

function fmt(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

console.log("DeskLumina Daemon Boot Benchmark");
console.log(`Runs: ${RUNS}`);
console.log("─".repeat(50));

const times = await measureDaemonBoot();
const s = stats(times);

console.log(`  p50:    ${fmt(s.p50)}`);
console.log(`  p95:    ${fmt(s.p95)}`);
console.log(`  p99:    ${fmt(s.p99)}`);
console.log(`  avg:    ${fmt(s.avg)}`);
console.log(`  stddev: ${fmt(s.stddev)}`);
console.log("─".repeat(50));
