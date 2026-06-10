import { describe, expect, test } from "bun:test";
import { formatMemoryBlock } from "../src/ltm";
import { tokenManager } from "../src/core/services/token-manager";
import type { LtmEntry, LtmPromptPayload } from "../src/ltm";

function entry(value: string, layer: LtmEntry["layer"] = "fact", lastAccessed = Date.now()): LtmEntry {
  return {
    id: crypto.randomUUID(),
    layer,
    key: layer === "episodic" ? null : "key",
    value,
    accessCount: 0,
    lastAccessed,
    createdAt: lastAccessed,
  };
}

describe("LTM formatter", () => {
  test("formats facts, patterns, and episodic entries as narrative bullets", () => {
    const payload: LtmPromptPayload = {
      facts: [entry("The user's name is Rapa.")],
      patterns: [entry("The user frequently asks about Linux.", "pattern")],
      episodic: [entry("The user configured Groq.", "episodic")],
      isEmpty: false,
    };

    const text = formatMemoryBlock(payload, 600);

    expect(text).toContain("LONG-TERM MEMORY:");
    expect(text).toContain("Facts about the user:");
    expect(text).toContain("- The user's name is Rapa.");
    expect(text).toContain("Behavioral patterns:");
    expect(text).toContain("Relevant past interactions:");
  });

  test("omits empty sections", () => {
    const text = formatMemoryBlock({
      facts: [entry("The user prefers English.")],
      patterns: [],
      episodic: [],
      isEmpty: false,
    }, 600);

    expect(text).toContain("Facts about the user:");
    expect(text).not.toContain("Behavioral patterns:");
    expect(text).not.toContain("Relevant past interactions:");
  });

  test("empty payload produces empty string", () => {
    expect(formatMemoryBlock({ facts: [], patterns: [], episodic: [], isEmpty: true }, 600)).toBe("");
  });

  test("token budget truncation drops lowest priority entries first", () => {
    const fact = entry("The user prefers concise answers.");
    const pattern = entry("The user frequently asks about Linux system administration.", "pattern");
    const episodic = entry("The user previously configured a long custom daemon workflow.", "episodic");
    const budget = tokenManager.estimateTokens(formatMemoryBlock({
      facts: [fact],
      patterns: [pattern],
      episodic: [],
      isEmpty: false,
    }, 600));

    const text = formatMemoryBlock({
      facts: [fact],
      patterns: [pattern],
      episodic: [episodic],
      isEmpty: false,
    }, budget);

    expect(text).toContain(fact.value);
    expect(text).toContain(pattern.value);
    expect(text).not.toContain(episodic.value);
    expect(tokenManager.estimateTokens(text)).toBeLessThanOrEqual(budget);
  });

  test("output never exceeds token budget", () => {
    const payload: LtmPromptPayload = {
      facts: [
        entry("The user prefers concise answers with direct next steps."),
        entry("The user works on Linux desktop automation."),
      ],
      patterns: [entry("The user often asks for implementation plans before changes.", "pattern")],
      episodic: [entry("The user recently asked about a daemon cache issue.", "episodic")],
      isEmpty: false,
    };

    const text = formatMemoryBlock(payload, 20);

    expect(tokenManager.estimateTokens(text)).toBeLessThanOrEqual(20);
  });
});
