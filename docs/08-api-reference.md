# 08 - API Reference

A detailed reference for DeskLumina's internal APIs, tool contracts, and execution signatures.

---

## Table of Contents

- [Core API (Lumina)](#core-api-lumina)
- [Agent API](#agent-api)
- [Result Store API](#result-store-api)
- [Dispatch Mode API](#dispatch-mode-api)
- [Terminal Classifier API](#terminal-classifier-api)
- [LTM API](#ltm-api)
- [Tool Contracts API](#tool-contracts-api)
- [Tool Handler Signature](#tool-handler-signature)
- [Chat State API](#chat-state-api)
- [Internationalization API (i18n)](#internationalization-api-i18n)
- [Error Classification API](#error-classification-api)
- [Clipboard Utility API](#clipboard-utility-api)
- [TTS API](#tts-api)
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

## Result Store API

**File**: `src/tools/result-store.ts`

The result store tracks background (non-blocking) operations across agent turns.

### `resultStore.registerPending(op: PendingOperation): void`
Registers a new background operation as pending.

### `resultStore.complete(operationId: string, result: ToolResult): void`
Marks a pending operation as completed. Moves the record from the pending map to the completed map.

### `resultStore.drainCompleted(): CompletedOperation[]`
Returns all completed operations and clears the completed map. Called once per agent turn to inject results into context.

### `resultStore.getPending(): PendingOperation[]`
Returns all currently pending operations.

### `resultStore.shutdown(): Promise<void>`
Cleans up all state on daemon shutdown. Logs warnings for any abandoned pending operations.

### `PendingOperation` Interface
```typescript
interface PendingOperation {
  id: string;
  tool: string;
  arg: string;
  startedAt: number;
  status: "pending";
}
```

### `CompletedOperation` Interface
```typescript
interface CompletedOperation {
  id: string;
  tool: string;
  arg: string;
  startedAt: number;
  completedAt: number;
  status: "success" | "failure";
  result: ToolResult;
}
```

---

## Dispatch Mode API

**File**: `src/tools/registry/modes.ts`

Controls whether tools execute in blocking or non-blocking mode.

### `getDispatchMode(toolName: string, arg?: string): DispatchMode`
Returns the dispatch mode for a given tool. For the `terminal` tool, the mode is determined dynamically by the command classifier.

### `getDispatchConfig(toolName: string): ToolDispatchConfig`
Returns the full dispatch configuration including optional `timeoutMs`.

### `DispatchMode` Type
```typescript
type DispatchMode = "blocking" | "non-blocking";
```

### `ToolDispatchConfig` Interface
```typescript
interface ToolDispatchConfig {
  mode: DispatchMode;
  timeoutMs?: number;
}
```

### Default Tool Modes

| Tool | Mode |
|------|------|
| `terminal` | blocking* (hybrid, classified per-command) |
| `file` | blocking |
| `math` | blocking |
| `clipboard` | blocking |
| `music` | blocking |
| `media` | blocking |
| `app` | non-blocking |
| `notify` | non-blocking |

---

## Terminal Classifier API

**File**: `src/tools/frameworks/terminal-classify.ts`

Classifies terminal commands into execution modes before dispatch.

### `classifyCommand(command: string): TerminalClassification`
Analyzes a command string and returns its classification.

### `TerminalMode` Type
```typescript
type TerminalMode = "blocking" | "non-blocking" | "rejected";
```

### `TerminalClassification` Interface
```typescript
interface TerminalClassification {
  mode: TerminalMode;
  command: string;
  reason: string;
}
```

### Classification Rules

- **Non-blocking**: Known GUI applications (e.g., `firefox`, `code`, `mpv`, `thunar`) or commands ending with `&`.
- **Rejected**: Empty commands or interactive `ssh` sessions without a remote command.
- **Blocking**: All other commands (default).

The classifier also rewrites interactive installer commands to include non-interactive flags (`-y` for apt/dnf/yum, `--noconfirm` for pacman).

---

## LTM API

**Files**: `src/ltm/index.ts`, `src/ltm/pipeline/*`, `src/ltm/storage/storage.ts`

### `buildLtmContext(query: string): Promise<string>`
Builds the inject-ready LTM narrative block. Retrieval includes facts and patterns plus semantic episodic matches (when enabled).

### `triggerLtmExtraction(userMessage: string, assistantResponse: string): void`
Fire-and-forget extraction pipeline. Non-fatal by design.

### `extractMemories(userMessage: string, assistantResponse: string): Promise<void>`
Executes extraction end-to-end:
- provider/model resolution (chat via `ltm.model`, embedding via `ltm.embedModel` resolution chain),
- extraction parse,
- fact/pattern upsert,
- episodic insert with optional embeddings,
- cap-based episodic eviction.

### `retrieveMemory(query: string, store?: LtmStore | null): Promise<LtmPromptPayload>`
Retrieves memory payload for prompt injection.
- Semantic mode: query embedding via resolved `embedModel` -> cosine scoring -> threshold filter -> top-K.
- Graceful fallback: lexical episodic retrieval if query embedding is unavailable.

### `LtmStore.insertEpisodic(value: string, embedding?: string | null): LtmEntry`
Persists episodic memory. Embedding is stored as JSON text (`TEXT`) or `NULL`.

### `LtmStore.getAllEpisodicWithEmbeddings(): EpisodicVectorEntry[]`
Returns episodic rows with raw embedding payloads for vector scoring.

---

## Provider Configuration API

**File**: `src/ai/types/provider.ts`

### `ProviderConfig` Interface

```typescript
interface ProviderConfig {
  readonly model: string;
  readonly embedModel?: string; // bare id (uses `provider`) or `provider:model` ref
}
```

Used wherever a chat+embedding pair is bound: `models.json` `primary`/`aliases` entries, and LTM `ModelBinding`. The `embedModel` field is optional and is resolved independently from `model` by `resolveEmbeddingProvider()` in `src/ltm/pipeline/extractor.ts:resolveEmbeddingProvider`.

### `ProviderCapability` Interface

```typescript
interface ProviderCapability {
  readonly maxContextTokens: number;
  readonly streamingSupported: boolean;
  readonly visionSupported: boolean;
  readonly jsonModeSupported: boolean;
  readonly functionCallingSupported: boolean;
  readonly embeddingsSupported: boolean;
  readonly tpmLimit?: number;
}
```

When `embeddingsSupported: false`, calling `provider.embed()` throws an error that names the provider and the model, and the LTM embedding step degrades to a `null` vector. `BaseProvider` no longer exposes a stub `embed?()` method; capability must be declared explicitly per provider.

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
  status?: string;        // Machine-readable status code (e.g. "search_complete", "dispatched")
  expression?: string;    // Normalized input expression (math tool only)
  numericResult?: number; // Raw numeric result (math tool only)
  actions?: string[];     // List of internal steps performed
  resolvedBackend?: "mpc" | "playerctl"; // Active media backend (music tool only)
  extra?: ToolExtraData;  // Structured data container for file, media, and search results
}
```

### `ToolResult` Interface

Used across the agent loop and UI layer. Extends `ToolExecutionResult` fields with retry tracking and non-blocking dispatch metadata:

```typescript
interface ToolResult {
  tool: string;
  result: string;
  success?: boolean;
  normalizedArg?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  attempt?: number;        // Retry attempt number (0-based)
  status?: string;
  expression?: string;
  numericResult?: number;
  actions?: string[];
  resolvedBackend?: "mpc" | "playerctl";
  extra?: ToolExtraData;
  dispatched?: boolean;    // True when this is a synthetic acknowledgement of a non-blocking dispatch
  operationId?: string;    // Links the synthetic result to its background task in the result store
}
```

### `DispatchedResult` Interface

Returned to the agent loop when a tool is dispatched non-blocking:

```typescript
interface DispatchedResult {
  tool: string;
  result: string;
  success: true;
  normalizedArg: string;
  dispatched: true;
  operationId: string;
}
```

### `ToolExtraData`

Structured data container used by tools to return rich results:

```typescript
interface ToolExtraData {
  tracks?: TrackInfo[];                          // Music track information
  activePrimaryBackend?: "mpc" | "playerctl" | null; // Active media backend
  files?: FileMatch[];                           // File search results
  selectedFile?: string;                         // User-selected file (fzf)
  preview?: FilePreview;                         // File/directory preview
  summary?: ToolExecutionSummary;                // Search execution metadata
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

## Error Classification API

**File**: `src/ui/error-classify.ts`

Classifies arbitrary errors into one of seven categories for the Rofi error UI.

### `classifyError(error: unknown): ErrorCategory`

Maps a thrown value to a category. The check order prioritizes specific signal classes (auth, ratelimit) before coarser heuristics (network, timeout, provider).

### `ErrorCategory` Type

```typescript
type ErrorCategory =
  | "network"
  | "provider"
  | "model"
  | "auth"
  | "ratelimit"
  | "timeout"
  | "unknown";
```

### `buildRawErrorString(error: unknown): string`

Constructs the full, unmodified error string used by the Copy action. Includes `rawPayload`, message, HTTP status code, and attempted models list when available.

### `truncateRawPreview(raw: string): string`

Truncates a raw error string to a 60-character preview with a Unicode-safe ellipsis (`···`). Counts code points, not UTF-16 units.

### `CATEGORY_I18N_KEYS`

Mapping of each `ErrorCategory` to its localized title and suggestion i18n keys (e.g., `error.network.title`, `error.network.suggestion`).

---

## Clipboard Utility API

**File**: `src/utils/system/clipboard-raw.ts`

Provides clipboard operations for error copying and other raw text operations.

### `resolveClipboardBinary(): "clipcatctl" | "wl-copy" | "xclip" | null`

Resolves the best available clipboard utility based on session type and system availability. Resolution order:

1. `clipcatctl` (if available)
2. `wl-copy` (if Wayland session)
3. `xclip` (always available as fallback)

### `copyRawErrorToClipboard(text: string): Promise<boolean>`

Copies the given text to the system clipboard using the resolved binary. Returns `true` on success, `false` if no clipboard utility is found or the operation fails. Uses `Bun.spawn` for all operations.

---

## TTS API

**File**: `src/ai/tts.ts`

### `isTTSPlaying(): boolean`

Returns `true` if a TTS playback session is currently active and not cancelled. Used internally to track audio state and trigger response panel auto-dismiss when playback completes.

### `cancelTTS(): Promise<void>`

Cancels the active TTS session, kills all associated audio processes, and clears the session reference. Thread-safe via `AsyncMutex`.

### `textToSpeech(text: string): Promise<void>`

Generates and plays audio for the given text. Uses adaptive chunking, optional natural voice disfluency planning, and latency masking. The response panel is auto-dismissed via `dismissResponsePanel()` when playback completes successfully.

---

## Daemon Socket Protocol

**Transport**: HTTP over Unix Domain Socket  
**Path**: `$XDG_RUNTIME_DIR/desklumina.sock` (falls back to `~/.config/desklumina/desklumina.sock`)

### Public Endpoints (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` or `/v1/healthz` | Health check. Returns `OK`, PID, and uptime. |
| `GET` | `/v1/diag` | Cache diagnostics (JSON). |
| `GET` | `/v1/theme/default` | Resolved Rofi theme path (JSON). |

### Command Endpoints (auth required)

All command requests require an `Authorization: Bearer <token>` header. The token is read from `~/.config/desklumina/.daemon-token`.

**GET Request:**
`GET /?cmd=<url_encoded_command> HTTP/1.1`

**POST Request:**
`POST /v1/command` with JSON body `{ "cmd": "your command" }`

### JSON Response
The response includes the final text `response`, a list of `toolResults`, `callback` events, and any supplemental data like `files` or `summary`.

---

## Next Steps

- 🛠️ **[Development Guide](10-development.md)**: Learn how to use these APIs to build new features.
- 🧪 **[Testing Guide](12-testing.md)**: Verify API behavior with unit tests.

---

[← Tools Reference](07-tools-reference.md) | [Security →](09-security.md)
