import { logger } from "../../logger";
import { tokenManager } from "../../core/services/token-manager";
import type { LtmEntry, LtmPromptPayload } from "../core/types";

interface Section {
  label: string;
  entries: LtmEntry[];
}

interface IncludedSection {
  label: string;
  values: string[];
}

export function formatMemoryBlock(payload: LtmPromptPayload, tokenBudget: number): string {
  if (payload.isEmpty || tokenBudget <= 0) return "";

  const included: IncludedSection[] = [];
  const sections: Section[] = [
    { label: "Facts about the user:", entries: payload.facts },
    { label: "Behavioral patterns:", entries: payload.patterns },
    { label: "Relevant past interactions:", entries: payload.episodic },
  ];

  for (const section of sections) {
    const current: IncludedSection = { label: section.label, values: [] };

    for (const entry of section.entries) {
      const candidate = [
        ...included,
        { label: current.label, values: [...current.values, entry.value] },
      ];
      const text = renderSections(candidate);
      if (tokenManager.estimateTokens(text) <= tokenBudget) {
        current.values.push(entry.value);
      } else {
        logger.debug("ltm", `Token budget truncated LTM entry in section ${section.label}`);
      }
    }

    if (current.values.length > 0) {
      included.push(current);
    }
  }

  const rendered = renderSections(included);
  return tokenManager.estimateTokens(rendered) <= tokenBudget ? rendered : "";
}

function renderSections(sections: IncludedSection[]): string {
  const nonEmpty = sections.filter((section) => section.values.length > 0);
  if (nonEmpty.length === 0) return "";

  const parts = nonEmpty.map((section) => {
    const bullets = section.values.map((value) => `- ${value}`).join("\n");
    return `${section.label}\n${bullets}`;
  });

  return `LONG-TERM MEMORY:\n\n${parts.join("\n\n")}`;
}
