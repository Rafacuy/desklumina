import { describe, test, expect } from "bun:test";
import { classifyCommand } from "../src/tools/frameworks/terminal-classify";

describe("terminal-classify — non-blocking detection", () => {
  test("trailing '&' triggers non-blocking and is stripped", () => {
    const c = classifyCommand("alacritty &");
    expect(c.mode).toBe("non-blocking");
    expect(c.command).toBe("alacritty");
    expect(c.reason).toContain("trailing '&'");
  });

  test("trailing '&' with surrounding whitespace", () => {
    const c = classifyCommand("sleep 60   &  ");
    expect(c.mode).toBe("non-blocking");
    expect(c.command).toBe("sleep 60");
  });

  test("GUI app without '&' triggers non-blocking", () => {
    const c = classifyCommand("code ~/projects/new-app");
    expect(c.mode).toBe("non-blocking");
    expect(c.command).toBe("code ~/projects/new-app");
    expect(c.reason).toContain("GUI");
  });

  test("mpv media player is non-blocking", () => {
    const c = classifyCommand("mpv ~/music/song.mp3");
    expect(c.mode).toBe("non-blocking");
    expect(c.command).toBe("mpv ~/music/song.mp3");
  });

  test("firefox is non-blocking", () => {
    const c = classifyCommand("firefox");
    expect(c.mode).toBe("non-blocking");
  });

  test("xdg-open is non-blocking", () => {
    const c = classifyCommand("xdg-open https://youtube.com");
    expect(c.mode).toBe("non-blocking");
  });

  test("GUI app with trailing '&' mentions both reasons", () => {
    const c = classifyCommand("alacritty &");
    expect(c.mode).toBe("non-blocking");
    expect(c.reason).toContain("trailing '&'");
    expect(c.reason).toContain("GUI");
  });

  test("nohup wrapper is stripped before GUI detection", () => {
    const c = classifyCommand("nohup firefox");
    expect(c.mode).toBe("non-blocking");
    expect(c.command).toBe("nohup firefox");
  });

  test("sudo wrapper is stripped before GUI detection", () => {
    const c = classifyCommand("sudo alacritty");
    expect(c.mode).toBe("non-blocking");
  });

  test("env VAR=val wrapper is stripped before GUI detection", () => {
    const c = classifyCommand("env DISPLAY=:0 firefox");
    expect(c.mode).toBe("non-blocking");
  });

  test("absolute path GUI binary is matched by basename", () => {
    const c = classifyCommand("/usr/bin/firefox");
    expect(c.mode).toBe("non-blocking");
  });
});

describe("terminal-classify — blocking detection", () => {
  test("mkdir compound command is blocking", () => {
    const c = classifyCommand("mkdir ~/projects/new-app && cd ~/projects/new-app");
    expect(c.mode).toBe("blocking");
    expect(c.command).toBe("mkdir ~/projects/new-app && cd ~/projects/new-app");
  });

  test("git clone is blocking", () => {
    const c = classifyCommand("git clone https://github.com/user/repo");
    expect(c.mode).toBe("blocking");
  });

  test("ffmpeg is blocking (output is meaningful)", () => {
    const c = classifyCommand("ffmpeg -i input.mp4 output.mp3");
    expect(c.mode).toBe("blocking");
  });

  test("sleep 9999 is blocking (timeout safety net handles it)", () => {
    const c = classifyCommand("sleep 9999");
    expect(c.mode).toBe("blocking");
  });

  test("notify-send is blocking (exits immediately, not a GUI launch)", () => {
    const c = classifyCommand('notify-send "Task done"');
    expect(c.mode).toBe("blocking");
  });

  test("ls is blocking", () => {
    const c = classifyCommand("ls -la /tmp");
    expect(c.mode).toBe("blocking");
  });

  test("python3 server.py defaults to blocking (ambiguous)", () => {
    const c = classifyCommand("python3 server.py");
    expect(c.mode).toBe("blocking");
  });

  test("ssh with a remote command is blocking (not rejected)", () => {
    const c = classifyCommand("ssh user@remote 'ls -la'");
    expect(c.mode).toBe("blocking");
  });
});

describe("terminal-classify — interactive installer rewriting", () => {
  test("sudo apt install gets -y added", () => {
    const c = classifyCommand("sudo apt install vim");
    expect(c.mode).toBe("blocking");
    expect(c.command).toBe("sudo apt install -y vim");
  });

  test("apt-get install gets -y added", () => {
    const c = classifyCommand("apt-get install -y foo");
    expect(c.mode).toBe("blocking");
    expect(c.command).toBe("apt-get install -y foo");
  });

  test("apt install without -y gets -y added", () => {
    const c = classifyCommand("apt install foo bar");
    expect(c.command).toBe("apt install -y foo bar");
  });

  test("dnf install gets -y added", () => {
    const c = classifyCommand("sudo dnf install vim");
    expect(c.command).toBe("sudo dnf install -y vim");
  });

  test("yum install gets -y added", () => {
    const c = classifyCommand("yum install vim");
    expect(c.command).toBe("yum install -y vim");
  });

  test("pacman -S gets --noconfirm added", () => {
    const c = classifyCommand("sudo pacman -S vim");
    expect(c.command).toBe("sudo pacman -S --noconfirm vim");
  });

  test("apt install already having -y is not double-rewritten", () => {
    const c = classifyCommand("apt install -y vim");
    expect(c.command).toBe("apt install -y vim");
  });

  test("pacman --sync gets --noconfirm added", () => {
    const c = classifyCommand("pacman --sync vim");
    expect(c.command).toBe("pacman --sync --noconfirm vim");
  });

  test("pacman -Syu (sync+upgrade) gets --noconfirm added", () => {
    const c = classifyCommand("sudo pacman -Syu");
    expect(c.command).toBe("sudo pacman -Syu --noconfirm");
  });
});

describe("terminal-classify — interactive ssh rejection", () => {
  test("ssh with only a host is rejected", () => {
    const c = classifyCommand("ssh user@remote");
    expect(c.mode).toBe("rejected");
    expect(c.reason).toContain("ssh");
  });

  test("ssh with -p flag and only host is rejected", () => {
    const c = classifyCommand("ssh -p 2222 user@remote");
    expect(c.mode).toBe("rejected");
  });

  test("ssh -i keyfile user@host is rejected (no remote command)", () => {
    const c = classifyCommand("ssh -i ~/.ssh/id_ed25519 user@remote");
    expect(c.mode).toBe("rejected");
  });

  test("ssh with verbose flag and host is rejected", () => {
    const c = classifyCommand("ssh -v user@remote");
    expect(c.mode).toBe("rejected");
  });

  test("ssh with a remote command is NOT rejected", () => {
    const c = classifyCommand("ssh user@remote uname -a");
    expect(c.mode).not.toBe("rejected");
  });

  test("ssh with quoted remote command is NOT rejected", () => {
    const c = classifyCommand("ssh user@remote 'ls -la /var/log'");
    expect(c.mode).not.toBe("rejected");
  });
});

describe("terminal-classify — edge cases", () => {
  test("empty command is rejected", () => {
    expect(classifyCommand("").mode).toBe("rejected");
    expect(classifyCommand("   ").mode).toBe("rejected");
  });

  test("command with internal '&' (not trailing) stays blocking", () => {
    const c = classifyCommand("echo foo && echo bar");
    expect(c.mode).toBe("blocking");
    expect(c.command).toBe("echo foo && echo bar");
  });

  test("command with piped background process at end is non-blocking", () => {
    const c = classifyCommand("long-running-job | tee log &");
    expect(c.mode).toBe("non-blocking");
    expect(c.command).toBe("long-running-job | tee log");
  });

  test("unknown binary defaults to blocking", () => {
    const c = classifyCommand("my-custom-script --flag value");
    expect(c.mode).toBe("blocking");
  });

  test("classification reason is non-empty for every mode", () => {
    for (const cmd of ["ls", "firefox", "ssh user@host", ""]) {
      const c = classifyCommand(cmd);
      expect(typeof c.reason).toBe("string");
      expect(c.reason.length).toBeGreaterThan(0);
    }
  });
});
