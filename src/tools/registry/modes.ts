import { classifyCommand } from "../frameworks/terminal-classify";

export type DispatchMode = "blocking" | "non-blocking";

export interface ToolDispatchConfig {
  mode: DispatchMode;
  timeoutMs?: number;
}

const DEFAULT_MODE: DispatchMode = "blocking";

const TOOL_MODES: Record<string, ToolDispatchConfig> = {
  // terminal is hybrid: the handler classifies each command and spawns
  // detached for GUI apps / &-suffixed commands, blocks for everything
  // else. 
  //
  // Exposed to the executor as "blocking" so the handler's own
  // decision drives the dispatch path.
  terminal: { mode: "blocking" },
  file:     { mode: "blocking" },
  math:     { mode: "blocking" },
  clipboard:{ mode: "blocking" },
  music:    { mode: "blocking" },
  media:    { mode: "blocking" },
  app:      { mode: "non-blocking" },
  notify:   { mode: "non-blocking" },
};

export function getDispatchMode(toolName: string, arg?: string): DispatchMode {
  if (toolName === "terminal" && arg) {
    const classification = classifyCommand(arg);
    if (classification.mode === "non-blocking") {
      return "non-blocking";
    }
  }
  return TOOL_MODES[toolName]?.mode ?? DEFAULT_MODE;
}

export function getDispatchConfig(toolName: string): ToolDispatchConfig {
  return TOOL_MODES[toolName] ?? { mode: DEFAULT_MODE };
}
