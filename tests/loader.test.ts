import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { startLoader, stopLoader } from "../src/ui/loader";

describe("Loader - Issue 18: Single-line spinner", () => {
  let originalWrite: typeof process.stdout.write;
  let writeCallCount = 0;
  let logCallCount = 0;

  beforeEach(() => {
    writeCallCount = 0;
    logCallCount = 0;
    
    originalWrite = process.stdout.write;
    process.stdout.write = mock((chunk: any) => {
      writeCallCount++;
      return true;
    }) as any;

    console.log = mock(() => {
      logCallCount++;
    }) as any;
  });

  afterEach(() => {
    stopLoader();
    process.stdout.write = originalWrite;
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
    process.stdout.write = mock((chunk: any) => {
      writes.push(String(chunk));
      return true;
    }) as any;

    startLoader();
    await new Promise(resolve => setTimeout(resolve, 1300));
    stopLoader();

    const updatesWithCarriageReturn = writes.filter(w => w.startsWith("\r"));
    expect(updatesWithCarriageReturn.length).toBeGreaterThan(0);
  });

  test("clears the line on stop", async () => {
    const writes: string[] = [];
    process.stdout.write = mock((chunk: any) => {
      writes.push(String(chunk));
      return true;
    }) as any;

    startLoader();
    await new Promise(resolve => setTimeout(resolve, 100));
    stopLoader();

    const lastWrite = writes[writes.length - 1];
    expect(lastWrite).toContain("\r");
  });

  test("does not create new lines during rotation", async () => {
    const writes: string[] = [];
    process.stdout.write = mock((chunk: any) => {
      writes.push(String(chunk));
      return true;
    }) as any;

    startLoader();
    await new Promise(resolve => setTimeout(resolve, 2500));
    stopLoader();

    const newlineWrites = writes.filter(w => w.includes("\n") && !w.startsWith("\r"));
    expect(newlineWrites.length).toBe(0);
  });
});
