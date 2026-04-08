# 08 - API Reference

A detailed reference for DeskLumina's internal APIs and tool signatures.

---

## Table of Contents

- [Core API (Lumina)](#core-api-lumina)
- [Tool Handler Signature](#tool-handler-signature)
- [Chat State API](#chat-state-api)
- [Security Analysis API](#security-analysis-api)
- [Daemon Socket Protocol](#daemon-socket-protocol)

---

## Core API (Lumina)

**File**: `src/core/lumina.ts`

The `Lumina` class is the main orchestrator.

### `chat(userMessage: string, onChunk?: (chunk: string, toolOutput?: string) => void): Promise<string>`
Processes user input, streams the AI response, executes tools, and returns the final assistant message.

- **`userMessage`**: The user's natural language input.
- **`onChunk`**: Optional callback invoked while streaming text. Receives `chunk` (text content) and optionally `toolOutput` (formatted tool execution results). When `toolOutput` is provided, `chunk` will be empty.
- **Returns**: The complete text response.

`chat()` now always constructs the model payload from:

```ts
[
  { role: "system", content: await buildSystemPrompt() },
  ...boundedContextMessages,
  { role: "user", content: userMessage },
]
```

If tool execution fails, Lumina captures structured tool feedback and performs up to 2 correction retries.

---

## Tool Handler Signature

All desktop automation tools must implement the following signature:

```typescript
type ToolHandler = (arg: string) => Promise<string> | string;
```

### Return Values

Tool handlers return a structured result object with a user-facing `result` string plus execution metadata such as `success`, `normalizedArg`, `stderr`, and `exitCode`.

---

## Chat State API

**File**: `src/core/chat-manager.ts`

### Storage location

Chats are saved under `~/.config/desklumina/chats/` as JSON files (see `src/core/chat-manager.ts`).

Tool execution is persisted as dedicated chat messages and replayed back to the model as compact tool-result context. Chat export also prunes older messages into summaries to keep token growth bounded.

---

## Security Analysis API

**File**: `src/security/dangerous-commands.ts`

### `analyzeCommand(command: string): CommandAnalysis`

See `src/security/dangerous-commands.ts` for the exact structure (`CommandAnalysis`) and severity selection (`highestSeverity`).

---

## Daemon Socket Protocol

**Transport**: HTTP over Unix Domain Socket  
**Path**: `~/.config/desklumina/daemon.sock`

### GET Request
`GET /?cmd=<url_encoded_command> HTTP/1.1`

### JSON Response
```json
{
  "success": true,
  "response": "The assistant's text response"
}
```

---

## Next Steps

- 🛠️ **[Development Guide](10-development.md)** — Learn how to use these APIs.
- 🧪 **[Testing Guide](12-testing.md)** — Verify API behavior with unit tests.

---

[← Tools Reference](07-tools-reference.md) | [Security →](09-security.md)
