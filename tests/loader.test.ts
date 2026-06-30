import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomLoaderImage, startLoader, stopLoader } from "../src/ui/loader";

describe("Loader: Single-line spinner", () => {
  let originalWrite: typeof Bun.stdout.write;
  let writeCallCount = 0;
  let logCallCount = 0;

  beforeEach(() => {
    writeCallCount = 0;
    logCallCount = 0;
    
    originalWrite = Bun.stdout.write;
    Bun.stdout.write = mock((chunk: any) => {
      writeCallCount++;
      return chunk?.length ?? 0;
    }) as any;

    console.log = mock(() => {
      logCallCount++;
    }) as any;
  });

  afterEach(() => {
    stopLoader();
    Bun.stdout.write = originalWrite;
  });

  test("uses process.stdout.write instead of console.log", async () => {
    startLoader();
    await new Promise(resolve => setTimeout(resolve, 100));
    stopLoader();

    expect(writeCallCount).toBeGreaterThan(0);
    expect(logCallCount).toBe(0);
  });

  test("uses carriage return for single-line updates", async () => {
    const writes: string[] = [];
    Bun.stdout.write = mock((chunk: any) => {
      writes.push(String(chunk));
      return chunk?.length ?? 0;
    }) as any;

    startLoader();
    await new Promise(resolve => setTimeout(resolve, 1300));
    stopLoader();

    const updatesWithCarriageReturn = writes.filter(w => w.startsWith("\r"));
    expect(updatesWithCarriageReturn.length).toBeGreaterThan(0);
  });

  test("clears the line on stop", async () => {
    const writes: string[] = [];
    Bun.stdout.write = mock((chunk: any) => {
      writes.push(String(chunk));
      return chunk?.length ?? 0;
    }) as any;

    startLoader();
    await new Promise(resolve => setTimeout(resolve, 100));
    stopLoader();

    const lastWrite = writes[writes.length - 1];
    expect(lastWrite).toContain("\r");
  });

  test("does not create new lines during rotation", async () => {
    const writes: string[] = [];
    Bun.stdout.write = mock((chunk: any) => {
      writes.push(String(chunk));
      return chunk?.length ?? 0;
    }) as any;

    startLoader();
    await new Promise(resolve => setTimeout(resolve, 2500));
    stopLoader();

    const newlineWrites = writes.filter(w => w.includes("\n") && !w.startsWith("\r"));
    expect(newlineWrites.length).toBe(0);
  });
});

describe("Loader: Rofi image picker", () => {
  test("randomly selects a readable file from a loader asset directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "desklumina-loader-"));
    const imagePath = join(dir, "lumina-test.png");

    try {
      writeFileSync(imagePath, "test");

      expect(randomLoaderImage(dir)).toBe(imagePath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns null when the loader asset directory is missing", () => {
    const dir = join(tmpdir(), `desklumina-loader-missing-${Date.now()}`);

    expect(randomLoaderImage(dir)).toBeNull();
  });

  test("returns null when the loader asset directory has no readable files", () => {
    const dir = mkdtempSync(join(tmpdir(), "desklumina-loader-empty-"));

    try {
      mkdirSync(join(dir, "nested"));

      expect(randomLoaderImage(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
