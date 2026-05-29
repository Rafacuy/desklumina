import { describe, test, expect } from "bun:test";
import { stripMarkersForDisplay, stripMarkers } from "../src/agent/signals";

describe("stripMarkersForDisplay", () => {
  test("preserves spaces when trimming markers", () => {
    const result = stripMarkersForDisplay("help you?");
    expect(result).toBe("help you?");
  });

  test("preserves leading spaces for chunk concatenation", () => {
    // AI streams tokens like: " can", " I", " help"
    const chunks = [" can", " I", " help"].map(stripMarkersForDisplay);
    const assembled = chunks.join("");
    expect(assembled).toBe(" can I help");
  });

  test("preserves trailing spaces for chunk concatenation", () => {
    // AI streams tokens like: "help ", "you?"
    const chunks = ["help ", "you?"].map(stripMarkersForDisplay);
    const assembled = chunks.join("");
    expect(assembled).toBe("help you?");
  });

  test("does not strip space-only chunks", () => {
    // AI sends space as separate token
    const result = stripMarkersForDisplay(" ");
    expect(result).toBe(" ");
  });

  test("handles chunks that are just markers", () => {
    const result = stripMarkersForDisplay("[[DONE]]");
    expect(result).toBe("");
  });

  test("strips DONE marker but keeps surrounding text spacing", () => {
    const result = stripMarkersForDisplay("help you? [[DONE]]");
    expect(result).toBe("help you? ");
  });

  test("strips FAIL marker but keeps surrounding text spacing", () => {
    const result = stripMarkersForDisplay("error occurred [[FAIL:timeout]]");
    expect(result).toBe("error occurred ");
  });

  test("simulates real streaming scenario", () => {
    // Simulate how the AI actually streams tokens
    const streamTokens = ["How", " can", " I", " help", " you?"];
    const processed = streamTokens.map(stripMarkersForDisplay);
    const assembled = processed.join("");
    expect(assembled).toBe("How can I help you?");
  });

  test("simulates streaming with marker at end", () => {
    const streamTokens = ["How", " can", " I", " help", " you?", " [[DONE]]"];
    const processed = streamTokens.map(stripMarkersForDisplay);
    const assembled = processed.join("").trim();
    expect(assembled).toBe("How can I help you?");
  });
});
