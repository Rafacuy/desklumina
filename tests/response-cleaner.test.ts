import { describe, test, expect } from "bun:test";
import { cleanAssistantResponse } from "../src/utils/response-cleaner";

describe("Response Cleaner (Duplicate Logic)", () => {
  test("removes JSON code blocks", () => {
    const input = 'Some text\n```json\n{"tool":"app","args":"test"}\n```\nMore text';
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Some text\n\nMore text");
  });

  test("removes tool tags", () => {
    const input = "Text before <tool:app>some content</tool:app> text after";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text before  text after");
  });

  test("removes Status lines", () => {
    const input = "Text\nStatus: Processing\n\nMore text";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text\n\nMore text");
  });

  test("removes Summary lines", () => {
    const input = "Text\nSummary: Done\nMore text";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text\nMore text");
  });

  test("removes Actions lines", () => {
    const input = "Text\nActions: Completed\nMore text";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text\nMore text");
  });

  test("removes Results lists", () => {
    const input = "Text\nResults:\n1. Item one\n2. Item two\n";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text");
  });

  test("removes separator lines", () => {
    const input = "Text\n━━━━━━━━━━\nMore text";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text\n\nMore text");
  });

  test("trims leading and trailing whitespace", () => {
    const input = "\n\n  Text content  \n\n";
    const result = cleanAssistantResponse(input);
    expect(result).toBe("Text content");
  });

  test("handles empty string", () => {
    const result = cleanAssistantResponse("");
    expect(result).toBe("");
  });

  test("handles complex mixed content", () => {
    const input = `Status: Processing
Some text
\`\`\`json
{"tool":"test"}
\`\`\`
<tool:app>content</tool:app>
Summary: Done
━━━━━━━━━━
Final text`;
    
    const result = cleanAssistantResponse(input);
    expect(result).toContain("Final text");
    expect(result).not.toContain("Status:");
    expect(result).not.toContain("```json");
    expect(result).not.toContain("<tool:");
    expect(result).not.toContain("Summary:");
    expect(result).not.toContain("━");
  });

  describe("Robustness - Tool Call Removal", () => {
    test("removes lenient JSON blocks (missing newlines)", () => {
      const input = 'Text ```json\n{"tool":"music","args":"stop"}``` Text';
      const result = cleanAssistantResponse(input);
      expect(result).toBe("Text  Text");
    });

    test("removes raw JSON tool calls from text", () => {
      const input = 'I will help. {"tool":"music","args":"stop"} Done.';
      const result = cleanAssistantResponse(input);
      expect(result).toBe("I will help.  Done.");
    });

    test("removes multiline raw JSON tool calls", () => {
      const input = `Sure!
{
  "tool": "music",
  "args": "stop"
}
Okay.`;
      const result = cleanAssistantResponse(input);
      expect(result).toBe("Sure!\n\nOkay.");
    });

    test("preserves non-tool JSON blocks", () => {
      const input = 'Here is a config: ```json\n{"theme":"dark"}\n```';
      const result = cleanAssistantResponse(input);
      expect(result).toBe('Here is a config: ```json\n{"theme":"dark"}\n```');
    });
  });
});
