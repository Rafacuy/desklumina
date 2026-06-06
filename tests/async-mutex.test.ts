import { describe, test, expect, beforeEach } from "bun:test";
import { AsyncMutex } from "../src/utils/async-mutex";

describe("AsyncMutex", () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  test("executes function exclusively", async () => {
    const result = await mutex.runExclusive(async () => 42);
    expect(result).toBe(42);
  });

  test("serializes concurrent access", async () => {
    const order: number[] = [];

    const task = async (id: number, delay: number) => {
      return mutex.runExclusive(async () => {
        order.push(id);
        await Bun.sleep(delay);
        return id;
      });
    };

    const results = await Promise.all([
      task(1, 20),
      task(2, 10),
      task(3, 5),
    ]);

    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  test("releases lock on error", async () => {
    try {
      await mutex.runExclusive(async () => {
        throw new Error("test");
      });
    } catch {}

    const result = await mutex.runExclusive(async () => "ok");
    expect(result).toBe("ok");
  });

  test("handles synchronous functions", async () => {
    const result = await mutex.runExclusive(() => "sync");
    expect(result).toBe("sync");
  });
});
