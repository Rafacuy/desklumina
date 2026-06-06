#!/usr/bin/env bun
import { spawnSync } from "bun";

const RUNS = 100;
const ENTRYPOINT = "src/main.ts";

function measureLauncherStartup(): number[] {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    const proc = spawnSync(["bun", "run", ENTRYPOINT, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    times.push(performance.now() - start);
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

console.log("DeskLumina Launcher Startup Benchmark");
console.log(`Runs: ${RUNS}`);
console.log("─".repeat(50));

const times = measureLauncherStartup();
const s = stats(times);

console.log(`  p50:    ${fmt(s.p50)}`);
console.log(`  p95:    ${fmt(s.p95)}`);
console.log(`  p99:    ${fmt(s.p99)}`);
console.log(`  avg:    ${fmt(s.avg)}`);
console.log(`  stddev: ${fmt(s.stddev)}`);
console.log("─".repeat(50));
