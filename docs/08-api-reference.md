# 08 - API Reference

A detailed reference for DeskLumina's internal APIs and tool signatures.

---

## Table of Contents

- [Core API (Lumina)](#core-api-lumina)
- [Tool Handler Signature](#tool-handler-signature)
- [Chat State API](#chat-state-api)
- [Security Analysis API](#security-analysis-api)
- [Internationalization API (i18n)](#internationalization-api-i18n)
- [Daemon Socket Protocol](#daemon-socket-protocol)

---

## Core API (Lumina)

**File**: `src/core/lumina.ts`

The `Lumina` class is the main orchestrator.

### `chat(userMessage: string, onChunk?: (chunk: string, callback?: ToolCallbackPayload) => void): Promise<string>`
Processes user input, streams the AI response, executes tools, and returns the final assistant message.

- **`userMessage`**: The user's natural language input.
- **`onChunk`**: Optional callback invoked while streaming text. Receives `chunk` and optionally a structured callback payload.
- **Returns**: The complete text response.

`chat()` constructs the model payload from:

```ts
[
  { role: "system", content: await buildSystemPrompt() },
  ...boundedContextMessages,
  { role: "user", content: userMessage },
]
```

If tool execution fails, Lumina captures structured tool feedback and performs up to 2 correction retries.
If tool execution succeeds, Lumina performs a second model pass using the tool results for a grounded final response.

### `ToolCallbackPayload`

Structured callback events use this shape:

```typescript
interface ToolCallbackPayload {
  type: "retry" | "results";
  text: string;
  results?: ToolResult[];
  tools?: string[];
  reason?: string;
}
```

- `retry`: emitted when Lumina is correcting failed tool arguments.
- `results`: emitted after tool execution completes; includes structured tool results for consumers.

---

## Tool Handler Signature

All desktop automation tools must implement the following signature:

```typescript
type ToolHandler = (arg: string) => Promise<string> | string;
```

### Return Values

Tool handlers return a structured result object with a user-facing `result` string and execution metadata such as `success`, `normalizedArg`, `stderr`, and `exitCode`.

---

## Chat State API

**File**: `src/core/chat-manager.ts`

### Storage location

Chats are saved under `~/.config/desklumina/chats/` as JSON files.

Tool execution is persisted as dedicated chat messages and replayed back to the model as compact tool-result context. Successful tool results are used immediately in a same-turn follow-up model pass. Chat export prunes older messages into summaries to keep token growth bounded.

---

## Security Analysis API

**File**: `src/security/dangerous-commands.ts`

### `analyzeCommand(command: string): CommandAnalysis`

See `src/security/dangerous-commands.ts` for the exact structure and severity selection.

---

## Internationalization API (i18n)

**File**: `src/utils/i18n.ts`

### `t(key: string): string`
Returns the translated string for the given key based on the current system language.

- **`key`**: The translation key (supports dot notation for nested objects).
- **Returns**: The translated string, or the key itself if no translation is found.

### `tf(key: string, vars: Record<string, string | number>): string`
Returns a translated string with parameter interpolation.

- **`key`**: The translation key.
- **`vars`**: An object containing key-value pairs to replace placeholders in the format `{varName}`.
- **Returns**: The translated string with all placeholders replaced.

### `setLang(lang: string): void`
Sets the current system language.

- **`lang`**: The language code, such as `"en"`, `"id"`, or `"ja"`.

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
  "response": "The assistant's text response",
  "status": "search_complete",
  "callback": "formatted tool display text",
  "callbackEvents": [
    {
      "type": "results",
      "text": "formatted tool display text"
    }
  ],
  "toolResults": [],
  "files": [],
  "selectedFile": "/home/user/.config/bspwm/bspwmrc",
  "actions": ["locate:name", "filter_results"],
  "summary": {
    "mode": "name",
    "query": "bspwm"
  }
}
```

---

## Next Steps

- 🛠️ **[Development Guide](10-development.md)**: Learn how to use these APIs.
- 🧪 **[Testing Guide](12-testing.md)**: Verify API behavior with unit tests.

---

[← Tools Reference](07-tools-reference.md) | [Security →](09-security.md)
