# 08 - API Reference

A detailed reference for DeskLumina's internal APIs, tool contracts, and execution signatures.

---

## Table of Contents

- [Core API (Lumina)](#core-api-lumina)
- [Agent API](#agent-api)
- [Tool Contracts API](#tool-contracts-api)
- [Tool Handler Signature](#tool-handler-signature)
- [Chat State API](#chat-state-api)
- [Internationalization API (i18n)](#internationalization-api-i18n)
- [Daemon Socket Protocol](#daemon-socket-protocol)

---

## Core API (Lumina)

**File**: `src/core/lumina.ts`

The `Lumina` class is the main orchestrator that coordinates between the UI and the Agent.

### `chat(userMessage: string, onChunk?: (chunk: string, callback?: ToolCallbackPayload) => void): Promise<string>`
Processes user input by invoking the bounded ReAct agent loop. It handles context preparation, terminal signal translation, and final response synthesis.

- **`userMessage`**: The user's natural language input.
- **`onChunk`**: Optional callback invoked while streaming text. Receives `chunk` and optionally a structured callback payload for tool execution updates.
- **Returns**: The complete text response, cleaned of internal terminal markers.

---

## Agent API

**Files**: `src/agent/agent.ts`, `src/agent/types.ts`

### `runAgent(baseMessages: AIMessage[], options?: AgentRunOptions): Promise<AgentResult>`
The entry point for the ReAct reasoning loop.

- **`baseMessages`**: Initial conversation history including system prompt and user query.
- **`options`**: Optional configuration including `maxTurns` and `onEvent` callback.

### `AgentResult` Interface
```typescript
export interface AgentResult {
  finalResponse: string;       // The last text response from the model
  allToolResults: ToolResult[]; // Flattened list of all tool results in the run
  history: AIMessage[];        // Final conversation history
  terminalSignal?: TerminalSignal; // The signal that ended the loop
}
```

### `TerminalSignal` Type
```typescript
export type TerminalSignal =
  | { type: "NONE" }
  | { type: "DONE" }
  | { type: "FAIL"; reason: string };
```

---

## Tool Contracts API

**File**: `src/tools/contracts/contracts.ts`

DeskLumina's prompt engine is driven by formal tool contracts.

### `ToolContract` Interface

```typescript
export interface ToolContract {
  name: string;
  description: string;
  schema: string;
  types: Record<string, string>;
  requiredArgs: string[];
  optionalArgs: string[];
  validFormats: string[];
  invalidFormats: string[];
  escapingRules: string;
  quotingRules: string;
  pathRules?: PathRules;
  output: OutputContract;
  failure: FailureContract;
  formatAnchors?: string[];
}
```

- **`validFormats` / `invalidFormats`**: Used to generate grounded examples in the system prompt.
- **`failure.retryLimit`**: Determines how many times Lumina will attempt to correct model errors before escalating.
- **`formatAnchors`**: Canonical JSON examples injected into the prompt to ensure correct tool-call formatting.

---

## Tool Handler Signature

All tools registered in `src/tools/registry/registry.ts` must implement the following signature:

```typescript
type ToolHandler = (arg: string) => Promise<ToolExecutionResult>;
```

### `ToolExecutionResult`

Tool handlers return a rich result object:

```typescript
interface ToolExecutionResult {
  tool: string;           // Name of the tool executed
  result: string;         // Human-readable summary of the outcome
  success: boolean;       // Whether the tool achieved its goal
  normalizedArg?: string; // The argument after expansion/normalization
  command?: string;       // The actual shell command executed (if any)
  stdout?: string;        // Raw output
  stderr?: string;        // Error output
  exitCode?: number;      // Process exit code
  status?: string;        // Machine-readable status code (e.g. "search_complete")
  expression?: string;    // Normalized input expression (math tool only)
  numericResult?: number; // Raw numeric result (math tool only)
  files?: FileMatch[];    // Structured results for file-related tools
  preview?: FilePreview;  // Preview data for file/directory tools
  actions?: string[];     // List of internal steps performed
}
```

---

## Chat State API

**File**: `src/core/services/chat-manager.ts`

### Storage location
Chats are saved under `~/.config/desklumina/chats/` as JSON files.

### Context Replay
Tool execution results are persisted as first-class messages. When replaying context for the model, these results are formatted into compact summaries within `user` messages:

```text
[TOOL RESULT: file]
status=ok
args=~/todo.md
file=/home/user/todo.md
preview=Task 1: Update docs...
```

---

## Internationalization API (i18n)

**File**: `src/utils/localization/i18n.ts`

### `t(key: string): string`
Returns the translated string for the given key based on the current system language.

### `tf(key: string, vars: Record<string, string | number>): string`
Returns a translated string with parameter interpolation (e.g., `{varName}`).

---

## Daemon Socket Protocol

**Transport**: HTTP over Unix Domain Socket  
**Path**: `~/.config/desklumina/daemon.sock`

### GET Request
`GET /?cmd=<url_encoded_command> HTTP/1.1`

### JSON Response
The response includes the final text `response`, a list of `toolResults`, and any supplemental data like `files` or `preview`.

---

## Next Steps

- 🛠️ **[Development Guide](10-development.md)**: Learn how to use these APIs to build new features.
- 🧪 **[Testing Guide](12-testing.md)**: Verify API behavior with unit tests.

---

[← Tools Reference](07-tools-reference.md) | [Security →](09-security.md)
