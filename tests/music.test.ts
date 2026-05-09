import { describe, test, expect, spyOn, afterEach } from "bun:test";
import { music } from "../src/tools/music";

describe("Music Tool (Generalized Media Controller)", () => {
  afterEach(() => {
    // @ts-ignore
    if (Bun.spawn.mock) {
      // @ts-ignore
      Bun.spawn.mockRestore();
    }
  });

  test("music tool is defined", () => {
    expect(music).toBeDefined();
    expect(typeof music).toBe("function");
  });

  test("unsupported action returns detailed error", async () => {
    const result = await music("search tracks");
    expect(result.success).toBe(false);
    expect(result.result).toContain("Unknown media action");
    expect(result.result).toContain("Supported: play, resume, pause, stop, next, prev, volume up, volume down");
  });

  test("handles core actions and aliases", async () => {
    // We mock Bun.spawn to return failure for everything so we can at least see it tries backends
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => ({
      stdout: new Response("").body,
      stderr: new Response("").body,
      exited: Promise.resolve(1)
    } as any));

    const actions = ["play", "resume", "pause", "stop", "next", "prev", "volume up", "volume down", "vol up", "vol down"];
    for (const action of actions) {
      const result = await music(action);
      expect(result.result).not.toContain("Unknown media action");
      expect(result.success).toBe(false); // Fails because our mock returns 1
    }
    
    expect(spawnSpy).toHaveBeenCalled();
  });

  test("fallback logic: tries MPC then Playerctl", async () => {
    let callCount = 0;
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation((args: any) => {
      callCount++;
      const cmd = args[0];
      
      if (cmd === "which") return { exited: Promise.resolve(0) } as any;
      if (cmd === "mpc") return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("err").body } as any;
      if (cmd === "playerctl") return { exited: Promise.resolve(0), stdout: new Response("ok").body, stderr: new Response("").body } as any;

      return { exited: Promise.resolve(0) } as any;
    });

    const result = await music("next");
    
    expect(result.success).toBe(true);
    expect(result.command).toContain("playerctl next");
    expect(spawnSpy).toHaveBeenCalled();
  });

  test("volume mapping: mpc uses +5/-5, playerctl uses 0.05+/0.05-", async () => {
    const commands: string[][] = [];
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      commands.push(args);
      if (args[0] === "which") return { exited: Promise.resolve(0) } as any;
      return { 
        exited: Promise.resolve(0), 
        stdout: new Response("").body, 
        stderr: new Response("").body 
      } as any;
    });

    await music("volume up");
    expect(commands.some(c => c[0] === "mpc" && c.includes("+5"))).toBe(true);

    commands.length = 0;
    spyOn(Bun, "spawn").mockRestore();
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      commands.push(args);
      if (args[1] === "mpc") return { exited: Promise.resolve(1) } as any; 
      if (args[0] === "which" && args[1] === "playerctl") return { exited: Promise.resolve(0) } as any;
      return { 
        exited: Promise.resolve(0), 
        stdout: new Response("ok").body, 
        stderr: new Response("").body 
      } as any;
    });

    await music("volume down");
    expect(commands.some(c => c[0] === "playerctl" && c.includes("0.05-"))).toBe(true);
  });

  test("handles structured JSON actions (primary inference format)", async () => {
    const commands: string[][] = [];
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      commands.push(args);
      if (args[0] === "which") return { exited: Promise.resolve(0) } as any;
      return { exited: Promise.resolve(0), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"action": "pause"}');
    expect(result.success).toBe(true);
    expect(result.normalizedArg).toBe("pause");
    expect(commands.some(c => c[0] === "mpc" && c.includes("pause"))).toBe(true);
  });

  test("intent resolution is resilient to slang and varied phrasing", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      if (args[0] === "which") return { exited: Promise.resolve(0) } as any;
      return { exited: Promise.resolve(0), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const cases = [
      { input: "skip this", expected: "next" },
      { input: "go back", expected: "prev" },
      { input: "shut the music up", expected: "stop" },
      { input: "turn it up", expected: "volume_up" },
      { input: "make it quieter", expected: "volume_down" },
      { input: "continue playback", expected: "resume" },
    ];

    for (const { input, expected } of cases) {
      const result = await music(input);
      expect(result.normalizedArg).toBe(expected);
    }
  });
});
