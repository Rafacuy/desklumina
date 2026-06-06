#!/usr/bin/env bun
import { CacheManager } from "../src/daemon/cache/cache-manager";

const RUNS = 1000;

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
  return `${ms.toFixed(4)} ms`;
}

async function benchCacheHits() {
  const cm = new CacheManager();
  await cm.warmup();

  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    await cm.settings.getOrLoad();
    times.push(performance.now() - start);
  }
  return times;
}

async function benchCacheMisses() {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const cm = new CacheManager();
    const start = performance.now();
    await cm.settings.getOrLoad();
    times.push(performance.now() - start);
  }
  return times;
}

console.log("DeskLumina Cache Benchmark");
console.log(`Runs: ${RUNS}`);
console.log("─".repeat(50));

console.log("\nCache HIT (warmed):");
const hitTimes = await benchCacheHits();
const hitStats = stats(hitTimes);
console.log(`  p50:    ${fmt(hitStats.p50)}`);
console.log(`  p95:    ${fmt(hitStats.p95)}`);
console.log(`  p99:    ${fmt(hitStats.p99)}`);
console.log(`  avg:    ${fmt(hitStats.avg)}`);
console.log(`  stddev: ${fmt(hitStats.stddev)}`);

console.log("\nCache MISS (cold):");
const missTimes = await benchCacheMisses();
const missStats = stats(missTimes);
console.log(`  p50:    ${fmt(missStats.p50)}`);
console.log(`  p95:    ${fmt(missStats.p95)}`);
console.log(`  p99:    ${fmt(missStats.p99)}`);
console.log(`  avg:    ${fmt(missStats.avg)}`);
console.log(`  stddev: ${fmt(missStats.stddev)}`);

console.log("─".repeat(50));
