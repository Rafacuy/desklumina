import { describe, test, expect, spyOn, afterEach, beforeEach } from "bun:test";
import { music } from "../src/tools/music";

describe("Music System Regression Tests", () => {
  beforeEach(() => {
    // @ts-ignore
    if (Bun.spawn.mock) {
      // @ts-ignore
      Bun.spawn.mockRestore();
    }
  });

  afterEach(() => {
    // @ts-ignore
    if (Bun.spawn.mock) {
      // @ts-ignore
      Bun.spawn.mockRestore();
    }
  });

  test("music current query handles empty title without shifting metadata (fix for title: null)", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc" || cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      if (cmd === "mpc status") return { exited: Promise.resolve(0), stdout: new Response("unknown.mp3\n[playing] #1/1   1:23/4:56 (28%)\nvolume:100%").body, stderr: new Response("").body } as any;
      if (cmd === "playerctl -l") return { exited: Promise.resolve(0), stdout: new Response("").body, stderr: new Response("").body } as any;
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true}');
    expect(result.success).toBe(true);
    expect(result.extra?.tracks?.length).toBe(1);
    const track = result.extra?.tracks![0];
    expect(track?.title).toBe("unknown.mp3");
    expect(track?.elapsed).toBe("1:23");
    expect(track?.duration).toBe("4:56");
  });

  test("music current query returns structured result with tracks array (not raw JSON string)", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc" || cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      if (cmd === "mpc status") return { exited: Promise.resolve(0), stdout: new Response("Song\tArtist\tAlbum\t4:56\n[playing] #1/1   1:23/4:56 (28%)\nvolume:100%").body, stderr: new Response("").body } as any;
      if (cmd === "playerctl -l") return { exited: Promise.resolve(0), stdout: new Response("").body, stderr: new Response("").body } as any;
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true}');
    expect(result.success).toBe(true);
    expect(result.tool).toBe("music");
    expect(result.extra?.tracks).toBeDefined();
    expect(result.extra?.tracks!.length).toBe(1);
    expect(result.extra?.activePrimaryBackend).toBe("mpc");
    expect(result.result).not.toContain('{"tracks":');
    expect(typeof result.result).toBe("string");
    expect(result.result.length).toBeGreaterThan(0);
  });

  test("music current query handles multiple players and activePrimaryBackend correctly", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc" || cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      if (cmd === "mpc status") return { exited: Promise.resolve(0), stdout: new Response("MPD Song\tMPD Artist\tMPD Album\t4:56\n[playing] #1/1   1:23/4:56 (28%)\nvolume:100%").body, stderr: new Response("").body } as any;
      if (cmd === "playerctl -l") return { exited: Promise.resolve(0), stdout: new Response("firefox\nspotify\n").body, stderr: new Response("").body } as any;
      if (cmd.includes("playerctl -p firefox metadata")) {
        return { exited: Promise.resolve(0), stdout: new Response("Playing\tYT Video\t\t\t42000000\t180000000\n").body, stderr: new Response("").body } as any;
      }
      if (cmd.includes("playerctl -p spotify metadata")) {
        return { exited: Promise.resolve(0), stdout: new Response("Paused\tSpotify Song\tSpotify Artist\tSpotify Album\t10000000\t200000000\n").body, stderr: new Response("").body } as any;
      }
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true}');
    expect(result.success).toBe(true);
    expect(result.extra?.tracks?.length).toBe(3);
    expect(result.extra?.activePrimaryBackend).toBe("mpc");
    const ytTrack = result.extra?.tracks?.find(t => t.player === "firefox");
    expect(ytTrack?.status).toBe("playing");
    expect(ytTrack?.title).toBe("YT Video");
    const spotTrack = result.extra?.tracks?.find(t => t.player === "spotify");
    expect(spotTrack?.status).toBe("paused");
  });

  test("music current query returns empty tracks when nothing is playing", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc") return { exited: Promise.resolve(1) } as any;
      if (cmd === "which playerctl") return { exited: Promise.resolve(1) } as any;
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true}');
    expect(result.success).toBe(true);
    expect(result.extra?.tracks).toEqual([]);
    expect(result.extra?.activePrimaryBackend).toBeNull();
  });

  test("music current query only queries specified backend (mpc only)", async () => {
    const queried: string[] = [];
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc") { queried.push("which_mpc"); return { exited: Promise.resolve(0) } as any; }
      if (cmd === "which playerctl") { queried.push("which_playerctl"); return { exited: Promise.resolve(0) } as any; }
      if (cmd === "mpc status") { queried.push("mpc_status"); return { exited: Promise.resolve(0), stdout: new Response("Song\n[playing] #1/1   1:23/4:56 (28%)\nvolume:100%").body, stderr: new Response("").body } as any; }
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true, "backends": ["mpc"]}');
    expect(result.success).toBe(true);
    expect(result.extra?.tracks?.length).toBe(1);
    expect(queried).not.toContain("which_playerctl");
    expect(queried).toContain("mpc_status");
  });

  test("music current query returns structured output that avoids AI hallucination", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc" || cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      if (cmd === "mpc status") return { exited: Promise.resolve(0), stdout: new Response("Midnight City - M83\n[playing] #1/1   1:23/4:03 (34%)\nvolume:100%").body, stderr: new Response("").body } as any;
      if (cmd === "playerctl -l") return { exited: Promise.resolve(0), stdout: new Response("").body, stderr: new Response("").body } as any;
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true}');
    expect(result.success).toBe(true);
    expect(result.tool).toBe("music");
    expect(result.extra?.tracks).toBeDefined();
    expect(Array.isArray(result.extra?.tracks)).toBe(true);
    expect(result.extra?.tracks!.length).toBe(1);
    expect(result.extra?.activePrimaryBackend).toBe("mpc");
    const track = result.extra?.tracks![0];
    expect(track?.backend).toBe("mpc");
    expect(track?.player).toBe("mpd");
    expect(track?.status).toBe("playing");
    expect(track?.title).toBe("Midnight City - M83");
    expect(track?.elapsed).toBe("1:23");
    expect(track?.duration).toBe("4:03");
    expect(result.result).not.toContain('{"tracks":');
    expect(typeof result.result).toBe("string");
  });

  test("music tool resolves backend explicitly", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc" || cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      if (cmd === "mpc status") return { exited: Promise.resolve(0), stdout: new Response("[playing]").body, stderr: new Response("").body } as any;
      if (cmd === "mpc play") return { exited: Promise.resolve(0), stdout: new Response("ok").body, stderr: new Response("").body } as any;
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"action": "play", "backend": "mpc"}');
    expect(result.success).toBe(true);
    expect(result.resolvedBackend).toBe("mpc");
  });

  test("music tool fails hard on explicit unavailable backend", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc") return { exited: Promise.resolve(1) } as any;
      if (cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"action": "play", "backend": "mpc"}');
    expect(result.success).toBe(false);
    expect(result.result).toContain("Backend not available");
  });

  test("music tool rejects unknown backend name", async () => {
    const result = await music('{"action": "play", "backend": "spotify"}');
    expect(result.success).toBe(false);
    expect(result.result).toContain("Unknown backend name");
    expect(result.exitCode).toBe(2);
  });

  test("music current query rejects malformed backends value", async () => {
    const result = await music('{"current": true, "backends": ["invalid"]}');
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
  });

  test("music rejects non-json input for current tracks", async () => {
    const result = await music('all');
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
  });

  test("playerctl elapsed/duration formatting converts microseconds correctly", async () => {
    spyOn(Bun, "spawn").mockImplementation((args: any) => {
      const cmd = args.join(" ");
      if (cmd === "which mpc") return { exited: Promise.resolve(1) } as any;
      if (cmd === "which playerctl") return { exited: Promise.resolve(0) } as any;
      if (cmd === "playerctl -l") return { exited: Promise.resolve(0), stdout: new Response("firefox\n").body, stderr: new Response("").body } as any;
      if (cmd.includes("playerctl -p firefox metadata")) {
        return { exited: Promise.resolve(0), stdout: new Response("Playing\tVideo Title\tChannel\t\t90000000\t300000000\n").body, stderr: new Response("").body } as any;
      }
      return { exited: Promise.resolve(1), stdout: new Response("").body, stderr: new Response("").body } as any;
    });

    const result = await music('{"current": true}');
    expect(result.success).toBe(true);
    expect(result.extra?.tracks?.length).toBe(1);
    const track = result.extra?.tracks![0];
    expect(track?.elapsed).toBe("1:30");
    expect(track?.duration).toBe("5:00");
  });
});
