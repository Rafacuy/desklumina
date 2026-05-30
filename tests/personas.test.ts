import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { settingsManager } from "../src/core/settings-manager";
import { getPersona, PERSONAS, PersonaType } from "../src/ai/personas";
import { buildSystemPrompt } from "../src/ai/prompts";
import { DEFAULT_SETTINGS } from "../src/types/settings";

describe("Multi-Persona System", () => {
  const originalSettings = { ...settingsManager.get() };

  beforeEach(() => {
    // Reset settings before each test
    settingsManager["settings"] = { ...DEFAULT_SETTINGS };
  });

  afterEach(() => {
    // Restore original settings
    settingsManager["settings"] = { ...originalSettings };
  });

  it("should return default persona when selected", () => {
    settingsManager.setPersona("default");
    const persona = getPersona(settingsManager.get().persona);
    expect(persona.id).toBe("default");
    expect(persona.prompt).toBe("");
  });

  it("should safely fallback to default for unknown personas", () => {
    settingsManager.setPersona("unknown_persona_xyz");
    const persona = getPersona(settingsManager.get().persona);
    expect(persona.id).toBe("default");
    expect(persona.prompt).toBe("");
  });

  it("should have correct token-length constraints for all personas (max 4 sentences / 1 paragraph)", () => {
    const allPersonas = Object.values(PERSONAS);
    for (const persona of allPersonas) {
      // Prompt should be a single paragraph (no double newlines)
      expect(persona.prompt.includes("\n\n")).toBe(false);

      if (persona.prompt !== "") {
        // Simple sentence count approximation using punctuation
        const sentenceCount = (persona.prompt.match(/[.!?]/g) || []).length;
        expect(sentenceCount).toBeLessThanOrEqual(4);
        expect(sentenceCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("should inject persona prompt into buildSystemPrompt", async () => {
    settingsManager.setPersona("tsundere");
    const systemPrompt = await buildSystemPrompt();
    expect(systemPrompt).toContain("You are Lumina, a deterministic Linux desktop assistant.");
    expect(systemPrompt).toContain("Tsundere: default to dismissive");
  });

  it("should not inject extra linebreaks for default persona", async () => {
    settingsManager.setPersona("default");
    const systemPrompt = await buildSystemPrompt();
    const identitySection = systemPrompt.split("\n\n")[0];
    expect(identitySection.trim()).toBe("You are Lumina, a deterministic Linux desktop assistant.");
  });

  it("should map all required personas", () => {
    const requiredPersonas: PersonaType[] = ["default", "tsundere", "catgirl", "deredere", "kuudere", "dandere"];
    for (const key of requiredPersonas) {
      expect(PERSONAS[key]).toBeDefined();
      expect(PERSONAS[key].translationKey).toBe(`ui.settings.personas.${key}`);
    }
  });
});
