import { describe, test, expect } from "bun:test";
import { cleanTrackTitle } from "../src/utils/format";

describe("cleanTrackTitle", () => {
  test("strips .mp3 extension", () => {
    expect(cleanTrackTitle("song-name.mp3")).toBe("song-name");
  });

  test("strips .wav extension", () => {
    expect(cleanTrackTitle("track.wav")).toBe("track");
  });

  test("strips .flac extension", () => {
    expect(cleanTrackTitle("music.flac")).toBe("music");
  });

  test("strips .m4a extension", () => {
    expect(cleanTrackTitle("podcast.m4a")).toBe("podcast");
  });

  test("strips .ogg extension", () => {
    expect(cleanTrackTitle("intro.ogg")).toBe("intro");
  });

  test("strips .aac extension", () => {
    expect(cleanTrackTitle("clip.aac")).toBe("clip");
  });

  test("strips .opus extension", () => {
    expect(cleanTrackTitle("voice.opus")).toBe("voice");
  });

  test("strips extensions case-insensitively", () => {
    expect(cleanTrackTitle("TRACK.MP3")).toBe("TRACK");
    expect(cleanTrackTitle("Song.Flac")).toBe("Song");
    expect(cleanTrackTitle("audio.WAV")).toBe("audio");
  });

  test("extracts basename from paths", () => {
    expect(cleanTrackTitle("sad-happy/blabla.mp3")).toBe("blabla");
    expect(cleanTrackTitle("music/rock/track.flac")).toBe("track");
    expect(cleanTrackTitle("library/2024/live/song.wav")).toBe("song");
  });

  test("extracts basename and strips extension from deep paths", () => {
    expect(cleanTrackTitle("Artist - Track Name.flac")).toBe("Artist - Track Name");
    expect(cleanTrackTitle("01. Intro.wav")).toBe("01. Intro");
  });

  test("returns null for null input", () => {
    expect(cleanTrackTitle(null)).toBeNull();
  });

  test("returns empty string unchanged (but falls back to original)", () => {
    expect(cleanTrackTitle("")).toBe("");
  });

  test("does not modify values without audio extensions", () => {
    expect(cleanTrackTitle("Midnight City")).toBe("Midnight City");
    expect(cleanTrackTitle("Song Title")).toBe("Song Title");
    expect(cleanTrackTitle("Artist - Track")).toBe("Artist - Track");
  });

  test("does not modify values with non-audio extensions", () => {
    expect(cleanTrackTitle("document.pdf")).toBe("document.pdf");
    expect(cleanTrackTitle("image.png")).toBe("image.png");
  });

  test("handles path without extension", () => {
    expect(cleanTrackTitle("some/path/My Song")).toBe("My Song");
  });

  test("handles double extensions correctly (only strips audio ext)", () => {
    expect(cleanTrackTitle("remix.edit.mp3")).toBe("remix.edit");
  });

  test("preserves whitespace and special characters in name", () => {
    expect(cleanTrackTitle("  my song  .mp3")).toBe("  my song  ");
  });
});