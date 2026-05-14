import { describe, test, expect } from "bun:test";
import { buildSystemPrompt } from "../../src/ai/prompts";
import { TOOL_CONTRACTS } from "../../src/tools/contracts";

describe("Prompt Architecture", () => {
  test("buildSystemPrompt should follow the required order", async () => {
    const prompt = await buildSystemPrompt();

    // Order
    const identityPos = prompt.indexOf("You are Lumina");
    const toolPos = prompt.indexOf("TOOL: app");
    const rulePos = prompt.indexOf("EXECUTION RULES:");
    const examplePos = prompt.indexOf("FORMAT ANCHORS:");
    const contextPos = prompt.indexOf("LIVE SYSTEM CONTEXT:");

    expect(identityPos).toBeGreaterThan(-1);
    expect(toolPos).toBeGreaterThan(identityPos);
    expect(rulePos).toBeGreaterThan(toolPos);
    expect(examplePos).toBeGreaterThan(rulePos);
    expect(contextPos).toBeGreaterThan(examplePos);
  });

  test("should include all tool contracts with description and escalation", async () => {
    const prompt = await buildSystemPrompt();
    for (const tool of TOOL_CONTRACTS) {
      expect(prompt).toContain(`TOOL: ${tool.name}`);
      expect(prompt).toContain(tool.description);
      expect(prompt).toContain(`SCHEMA: ${tool.schema}`);
      expect(prompt).toContain(`TYPES: ${JSON.stringify(tool.types)}`);
      expect(prompt).toContain("OUTPUT CONTRACT:");
      expect(prompt).toContain("FAILURE CONTRACT:");
      expect(prompt).toContain("Escalation:");

      if (tool.pathRules) {
        expect(prompt).toContain("PATH RULES:");
      }

      if (tool.optionalArgs.length === 0) {
        const section = prompt
          .split("---")
          .find((s) => s.includes(`TOOL: ${tool.name}`));
        expect(section).not.toContain("OPTIONAL:");
      }
    }
  });

  test("should include escalation rules", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain("FAILURE ESCALATION TREE:");
    expect(prompt).toContain("Failure 1:");
    expect(prompt).toContain("Failure 2:");
    expect(prompt).toContain("Failure 3:");
    expect(prompt).toContain("retry according to tool contract");
  });

  test("should have language-neutral formatting examples from contracts", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain("FORMAT ANCHORS:");
    // Check for JSON blocks generated from contracts
    expect(prompt).toContain(
      '{"tool":"music","args":"{\\"action\\":\\"play\\"}"}',
    );
    expect(prompt).toContain('{"tool":"app","args":"firefox"}');
  });
});
