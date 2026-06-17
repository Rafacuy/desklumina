import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, statSync } from "fs";
import { join } from "path";
import { fileOp } from "../src/tools/frameworks/files";
import { MAX_READ_BYTES } from "../src/tools/frameworks/file-shared";
import * as confirmation from "../src/security/confirmation";

const tempDir = join(process.cwd(), "tmp-files-tests");

describe("fileOp security", () => {
  let confirmSpy: ReturnType<typeof spyOn> | null = null;

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    confirmSpy?.mockRestore();
    confirmSpy = null;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("copy prompts for dangerous destination", async () => {
    confirmSpy = spyOn(confirmation, "rofiConfirm").mockResolvedValue(true);
    const src = join(tempDir, "src.txt");
    await Bun.write(src, "source");

    const result = await fileOp(`copy ${src} /etc/copied-by-test`);

    expect(confirmSpy).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  test("write prompts for dangerous path", async () => {
    confirmSpy = spyOn(confirmation, "rofiConfirm").mockResolvedValue(true);

    const result = await fileOp("write /etc/test-write permission denied");

    expect(confirmSpy).toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  test("rejects paths containing null bytes", async () => {
    const result = await fileOp("write /tmp/file\0name content");

    expect(result.success).toBe(false);
    expect(result.stderr?.toLowerCase()).toContain("null byte");
  });
});

describe("fileOp basic operations", () => {
  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("write creates an empty file when no content is given", async () => {
    const path = join(tempDir, "empty.txt");

    const result = await fileOp(`write ${path}`);

    expect(result.success).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect((await Bun.file(path).text())).toBe("");
  });

  test("write creates a file with the provided content", async () => {
    const path = join(tempDir, "hello.txt");

    const result = await fileOp(`write ${path} Hello, world!`);

    expect(result.success).toBe(true);
    expect(await Bun.file(path).text()).toBe("Hello, world!");
  });

  test("read rejects files larger than MAX_READ_BYTES", async () => {
    const path = join(tempDir, "huge.bin");
    const content = Buffer.alloc(MAX_READ_BYTES + 1, "a");
    await Bun.write(path, content);

    const result = await fileOp(`read ${path}`);

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(413);
    expect(result.stderr?.toLowerCase()).toContain("too large");
  });

  test("stat returns structured metadata", async () => {
    const path = join(tempDir, "stat-me.txt");
    await Bun.write(path, "content");

    const result = await fileOp(`stat ${path}`);

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.result);
    expect(parsed.path).toBe(path);
    expect(parsed.type).toBe("file");
    expect(typeof parsed.size).toBe("number");
    expect(parsed.humanSize).toContain("B");
    expect(typeof parsed.inode).toBe("number");
    expect(parsed.permissions).toMatch(/^\d{3}$/);
  });

  test("rename renames a file within the same directory", async () => {
    const src = join(tempDir, "old-name.txt");
    const dest = join(tempDir, "new-name.txt");
    await Bun.write(src, "content");

    const result = await fileOp(`rename ${src} new-name.txt`);

    expect(result.success).toBe(true);
    expect(existsSync(src)).toBe(false);
    expect(existsSync(dest)).toBe(true);
  });

  test("rename rejects new names containing path separators", async () => {
    const src = join(tempDir, "old.txt");
    await Bun.write(src, "content");

    const result = await fileOp(`rename ${src} ../escape.txt`);

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
  });

  test("touch creates a new file", async () => {
    const path = join(tempDir, "touched.txt");

    const result = await fileOp(`touch ${path}`);

    expect(result.success).toBe(true);
    expect(existsSync(path)).toBe(true);
  });

  test("touch updates mtime of an existing file", async () => {
    const path = join(tempDir, "touched.txt");
    await Bun.write(path, "content");
    const before = statSync(path).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 20));

    await fileOp(`touch ${path}`);

    const after = statSync(path).mtimeMs;
    expect(after).toBeGreaterThan(before);
  });

  test("chmod changes file permissions", async () => {
    const path = join(tempDir, "chmod-me.txt");
    await Bun.write(path, "content");
    await fileOp(`chmod ${path} 600`);

    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test("chown attempts ownership change", async () => {
    const path = join(tempDir, "chown-me.txt");
    await Bun.write(path, "content");

    const result = await fileOp(`chown ${path} root`);

    expect(result.command).toContain("chown");
    expect(result.command).toContain("root");
  });
});
