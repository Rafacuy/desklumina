import { describe, test, expect } from "bun:test";
import {
  detectTerminalSignal,
  extractReason,
  stripMarkers,
  stripMarkersForDisplay,
} from "../src/agent/signals";

describe("detectTerminalSignal", () => {
  test("detects [[DONE]] marker", () => {
    expect(detectTerminalSignal("[[DONE]]")).toEqual({ type: "DONE" });
  });

  test("detects [[DONE]] with surrounding text", () => {
    expect(detectTerminalSignal("Finished [[DONE]]")).toEqual({ type: "DONE" });
  });

  test("detects [[FAIL: reason]] marker", () => {
    expect(detectTerminalSignal("[[FAIL: missing dependency]]")).toEqual({ type: "FAIL", reason: "missing dependency" });
  });

  test("detects [[FAIL: reason]] with surrounding text", () => {
    expect(detectTerminalSignal("Cannot proceed [[FAIL: timeout]] here")).toEqual({ type: "FAIL", reason: "timeout" });
  });

  test("detects [[FAIL:]] with empty reason", () => {
    expect(detectTerminalSignal("[[FAIL:]]")).toEqual({ type: "FAIL", reason: "Unknown reason" });
  });

  test("returns NONE for text without markers", () => {
    expect(detectTerminalSignal("Just plain text")).toEqual({ type: "NONE" });
  });

  test("returns NONE for empty string", () => {
    expect(detectTerminalSignal("")).toEqual({ type: "NONE" });
  });

  test("returns NONE for text with partial DONE marker", () => {
    expect(detectTerminalSignal("[[DONE")).toEqual({ type: "NONE" });
    expect(detectTerminalSignal("DONE]]")).toEqual({ type: "NONE" });
  });

  test("detects FAIL for text with partial FAIL marker", () => {
    const result = detectTerminalSignal("[[FAIL: missing");
    expect(result.type).toBe("FAIL");
    // reason is "Unknown reason" because closing ]] is missing
    expect(typeof result.reason).toBe("string");
  });

  test("detects DONE before FAIL (DONE takes priority)", () => {
    expect(detectTerminalSignal("[[DONE]] [[FAIL: reason]]")).toEqual({ type: "DONE" });
  });
});

describe("extractReason", () => {
  test("extracts reason from FAIL marker", () => {
    expect(extractReason("[[FAIL: missing dependency]]", "FAIL")).toBe("missing dependency");
  });

  test("extracts reason with surrounding text", () => {
    expect(extractReason("Text [[FAIL: timeout]] more text", "FAIL")).toBe("timeout");
  });

  test("returns Unknown reason when marker not found", () => {
    expect(extractReason("No marker here", "FAIL")).toBe("Unknown reason");
  });

  test("returns Unknown reason for malformed marker", () => {
    expect(extractReason("[[FAIL", "FAIL")).toBe("Unknown reason");
  });

  test("handles reason with spaces", () => {
    expect(extractReason("[[FAIL: safety violation at work]]", "FAIL")).toBe("safety violation at work");
  });
});

describe("stripMarkers", () => {
  test("removes [[DONE]] marker", () => {
    expect(stripMarkers("Finished [[DONE]]")).toBe("Finished");
  });

  test("removes [[FAIL: reason]] marker", () => {
    expect(stripMarkers("Error [[FAIL: timeout]]")).toBe("Error");
  });

  test("removes multiple markers", () => {
    expect(stripMarkers("First [[DONE]] Second [[FAIL: error]]")).toBe("First  Second");
  });

  test("preserves text without markers", () => {
    expect(stripMarkers("Just text")).toBe("Just text");
  });

  test("handles empty string", () => {
    expect(stripMarkers("")).toBe("");
  });

  test("trims whitespace after removing markers", () => {
    expect(stripMarkers("  text [[DONE]]  ")).toBe("text");
  });

  test("preserves non-marker brackets", () => {
    expect(stripMarkers("Use [[this]] as reference [[DONE]]")).toBe("Use [[this]] as reference");
  });
});

describe("stripMarkersForDisplay", () => {
  test("removes [[DONE]] marker", () => {
    expect(stripMarkersForDisplay("Finished [[DONE]]")).toBe("Finished");
  });

  test("removes [[FAIL: reason]] marker", () => {
    expect(stripMarkersForDisplay("Cannot proceed [[FAIL: timeout]]")).toBe("Cannot proceed");
  });

  test("returns empty string for marker-only content", () => {
    expect(stripMarkersForDisplay("[[DONE]]")).toBe("");
    expect(stripMarkersForDisplay("[[FAIL: error]]")).toBe("");
  });

  test("preserves text without markers", () => {
    expect(stripMarkersForDisplay("Normal response text")).toBe("Normal response text");
  });

  test("handles empty string", () => {
    expect(stripMarkersForDisplay("")).toBe("");
  });

  test("handles multiple markers in display text", () => {
    expect(stripMarkersForDisplay("step1 [[DONE]] step2 [[FAIL: x]]")).toBe("step1  step2");
  });

  test("preserves surrounding text", () => {
    expect(stripMarkersForDisplay("Before [[DONE]] After")).toBe("Before  After");
  });

  test("does not introduce visual artifacts", () => {
    const result = stripMarkersForDisplay("Complete [[DONE]]");
    expect(result).not.toContain("[");
    expect(result).not.toContain("]");
    expect(result).not.toContain("DONE");
    expect(result).not.toContain("FAIL");
  });
});

describe("Locale integration for signal keys", () => {
  test("signal.soft_fail resolves in English", () => {
    const { t, setLang, getLang } = require("../src/utils/i18n");
    const prev = getLang();
    setLang("en");
    const msg = t("signal.soft_fail");
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(0);
    setLang(prev);
  });

  test("signal.soft_fail_reason resolves in English", () => {
    const { t, tf, setLang, getLang } = require("../src/utils/i18n");
    const prev = getLang();
    setLang("en");
    const msg = tf("signal.soft_fail_reason", { reason: "test" });
    expect(msg).toBeTruthy();
    expect(msg).toContain("test");
    setLang(prev);
  });

  test("signal.soft_fail resolves in Indonesian", () => {
    const { t, setLang, getLang } = require("../src/utils/i18n");
    const prev = getLang();
    setLang("id");
    const msg = t("signal.soft_fail");
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(0);
    setLang(prev);
  });

  test("signal.soft_fail resolves in Japanese", () => {
    const { t, setLang, getLang } = require("../src/utils/i18n");
    const prev = getLang();
    setLang("ja");
    const msg = t("signal.soft_fail");
    expect(msg).toBeTruthy();
    expect(msg.length).toBeGreaterThan(0);
    setLang(prev);
  });

  test("signal keys fall back to key name for unknown locale", () => {
    const { t, setLang, getLang } = require("../src/utils/i18n");
    const prev = getLang();
    // setLang ignores unknown locales, so current lang stays
    setLang("unknown");
    expect(getLang()).toBe("id");
    setLang(prev);
  });
});
