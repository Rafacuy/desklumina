# 📚 API Reference

Complete API reference for DeskLumina's core modules, classes, and functions.

---

## 📋 Table of Contents

- [Core Module](#core-module)
- [AI Module](#ai-module)
- [Tools Module](#tools-module)
- [Security Module](#security-module)
- [UI Module](#ui-module)
- [Utilities](#utilities)
- [Constants](#constants)
- [Types](#types)

---

## 🎯 Core Module

### `Lumina`

Main AI agent orchestrator that handles conversation flow, tool execution, and TTS.

**Location:** `src/core/lumina.ts`

```typescript
import { Lumina } from "./core";
```

#### Constructor

```typescript
constructor(chatManager: ChatManager)
```

#### Methods

##### `chat(prompt: string, onChunk?: (chunk: string) => void): Promise<void>`

Process a user prompt and stream AI response.

**Parameters:**
- `prompt: string` - User's input message
- `onChunk?: (chunk: string) => void` - Optional callback for streaming response

**Example:**
```typescript
const lumina = new Lumina(chatManager);
await lumina.chat("open telegram", (chunk) => {
  process.stdout.write(chunk);
});
```

##### `executeToolCalls(content: string): Promise<string>`

Parse and execute tool calls from AI response.

**Parameters:**
- `content: string` - AI response containing tool calls

**Returns:** `Promise<string>` - Formatted tool execution results

---

### `ChatManager`

Manages chat persistence, history, and session management.

**Location:** `src/core/chat-manager.ts`

```typescript
import { ChatManager } from "./core";
```

#### Constructor

```typescript
constructor()
```

#### Methods

##### `createChat(firstMessage: string): Chat`

Create a new chat session with auto-generated title.

**Parameters:**
- `firstMessage: string` - Initial user message

**Returns:** `Chat` - New chat object

##### `addMessage(role: "user" | "assistant", content: string): void`

Add a message to the current chat.

**Parameters:**
- `role: "user" | "assistant"` - Message role
- `content: string` - Message content

##### `addToolCall(toolCall: ToolCall): void`

Record a tool call in the current chat.

**Parameters:**
- `toolCall: ToolCall` - Tool call object

##### `addToolResult(result: ToolResult): void`

Record a tool execution result.

**Parameters:**
- `result: ToolResult` - Tool result object

##### `getCurrentChat(): Chat | null`

Get the current active chat.

**Returns:** `Chat | null` - Current chat or null

##### `getAllChats(): Chat[]`

Get all saved chats sorted by date.

**Returns:** `Chat[]` - Array of chat objects

##### `loadChat(index: number): boolean`

Load a specific chat by index.

**Parameters:**
- `index: number` - Chat index (1-based)

**Returns:** `boolean` - Success status

##### `newChat(): void`

Start a new chat session.

---

### `SettingsManager`

Manages application settings and feature flags.

**Location:** `src/core/settings-manager.ts`

```typescript
import { SettingsManager } from "./core";
```

#### Methods

##### `loadSettings(): Settings`

Load settings from `settings.json`.

**Returns:** `Settings` - Current settings

##### `saveSettings(settings: Settings): void`

Save settings to file.

**Parameters:**
- `settings: Settings` - Settings to save

##### `toggleFeature(flag: keyof FeatureFlags): void`

Toggle a feature flag.

**Parameters:**
- `flag: keyof FeatureFlags` - Feature name

---

### `ContextTracker`

Tracks conversation context including active window and application.

**Location:** `src/core/context.ts`

```typescript
import { ContextTracker } from "./core";
```

#### Methods

##### `getContext(): Promise<WindowContext>`

Get current window context.

**Returns:** `Promise<WindowContext>` - Active window info

##### `formatContext(): string`

Format context for system prompt.

**Returns:** `string` - Formatted context string

---

### `Planner`

Parses and plans tool calls from AI responses.

**Location:** `src/core/planner.ts`

```typescript
import { Planner } from "./core";
```

#### Methods

##### `parseToolCalls(content: string): ParsedToolCall[]`

Extract tool calls from AI response markdown.

**Parameters:**
- `content: string` - AI response content

**Returns:** `ParsedToolCall[]` - Array of parsed tool calls

---

## 🤖 AI Module

### `streamGroq(messages: AIMessage[]): AsyncGenerator<string>`

Stream AI response from Groq API with automatic model fallback.

**Location:** `src/ai/groq.ts`

**Parameters:**
- `messages: AIMessage[]` - Conversation history

**Returns:** `AsyncGenerator<string>` - Streaming text chunks

**Example:**
```typescript
import { streamGroq } from "./ai";

for await (const chunk of streamGroq(messages)) {
  process.stdout.write(chunk);
}
```

**Fallback Behavior:**
- Tries primary model first
- Falls back to `FALLBACK_MODELS` on failure
- Throws `AllModelsFailedError` if all models fail

---

### `buildSystemPrompt(): Promise<string>`

Build system prompt with environment context.

**Location:** `src/ai/prompts.ts`

**Returns:** `Promise<string>` - Complete system prompt

**Includes:**
- Tool definitions
- Window context
- Environment info
- Response format instructions

---

### `parseSSE(line: string): GroqStreamResponse | null`

Parse Server-Sent Event line from Groq API.

**Location:** `src/ai/stream.ts`

**Parameters:**
- `line: string` - SSE line

**Returns:** `GroqStreamResponse | null`

---

### `TextToSpeech`

Text-to-speech using Edge TTS.

**Location:** `src/ai/tts.ts`

```typescript
import { TextToSpeech } from "./ai";
```

#### Constructor

```typescript
constructor(voiceId?: string, speed?: number)
```

**Parameters:**
- `voiceId?: string` - Voice ID (default: `id-ID-GadisNeural`)
- `speed?: number` - Speech speed (default: `1.0`)

#### Methods

##### `speak(text: string): Promise<void>`

Convert text to speech and play audio.

**Parameters:**
- `text: string` - Text to speak

**Available Voices:**
- `id-ID-GadisNeural` - Female voice
- `id-ID-ArdiNeural` - Male voice

**Speed Options:** `0.5`, `0.75`, `1.0`, `1.25`, `1.5`, `2.0`

---

## 🔧 Tools Module

### Tool Handlers

All tool handlers follow this signature:

```typescript
async function toolName(action: string): Promise<string>
```

#### `app(action: string): Promise<string>`

Launch applications by alias.

**Location:** `src/tools/apps.ts`

**Example:**
```typescript
await app("browser");        // Opens default browser
await app("telegram");       // Opens Telegram
await app("nvim");           // Opens Neovim
```

---

#### `bspwm(action: string): Promise<string>`

Window and workspace management.

**Location:** `src/tools/bspwm.ts`

**Example:**
```typescript
await bspwm("focus_workspace 3");     // Switch to workspace 3
await bspwm("move_window_to 2");      // Move window to workspace 2
await bspwm("toggle_fullscreen");     // Toggle fullscreen
```

**Special Actions:**
- `wait_and_move <class> <workspace>` - Wait for window and move it

---

#### `clipboard(action: string): Promise<string>`

Clipboard management via Clipcat.

**Location:** `src/tools/clipboard.ts`

**Actions:**
- `get` - Get clipboard content
- `list` - List clipboard history
- `set <text>` - Set clipboard content
- `clear` - Clear clipboard

---

#### `fileOp(operation: string): Promise<string>`

File system operations.

**Location:** `src/tools/files.ts`

**Operations:**
- `create_dir <path>` - Create directory
- `delete <path>` - Delete file/folder
- `move <src> <dest>` - Move/rename
- `copy <src> <dest>` - Copy
- `list <path>` - List directory
- `read <path>` - Read file
- `write <path> <content>` - Write file
- `find <path> <pattern>` - Find files

---

#### `media(action: string): Promise<string>`

MPD music player control.

**Location:** `src/tools/media.ts`

**Actions:**
- `play`, `pause`, `toggle`, `stop`
- `next`, `prev`
- `volume <level>` - Set volume
- `current` - Show current track
- `queue` - Show playlist
- `search <query>` - Search library

---

#### `notify(action: string): Promise<string>`

Send desktop notifications.

**Location:** `src/tools/notify.ts`

**Format:** `title|body|urgency`

**Example:**
```typescript
await notify("Task Complete|File processed|normal");
```

**Urgency Levels:** `low`, `normal`, `critical`

---

#### `terminal(action: string): Promise<string>`

Execute shell commands with security checks.

**Location:** `src/tools/terminal.ts`

**Example:**
```typescript
await terminal("ls -la ~/Documents");
```

---

#### `getWindowInfo(): Promise<string>`

Get active window information.

**Location:** `src/tools/window-info.ts`

---

### Tool Registry

#### `registerTool(name: string, handler: ToolHandler): void`

Register a custom tool.

**Location:** `src/tools/registry.ts`

```typescript
import { registerTool } from "./tools";

registerTool("custom", async (arg) => {
  return `Custom result: ${arg}`;
});
```

---

#### `getRegisteredTools(): Record<string, ToolHandler>`

Get all registered tools.

**Returns:** `Record<string, ToolHandler>`

---

#### `dispatchTool(tool: string, args: string): Promise<string>`

Execute a tool by name.

**Parameters:**
- `tool: string` - Tool name
- `args: string` - Tool arguments

---

## 🔒 Security Module

### `isDangerousCommand(command: string): boolean`

Check if a command matches dangerous patterns.

**Location:** `src/security/dangerous-commands.ts`

**Returns:** `boolean`

---

### `analyzeCommand(command: string): CommandAnalysis`

Analyze command for security risks.

**Returns:**
```typescript
{
  isDangerous: boolean;
  highestSeverity: "safe" | "medium" | "high" | "critical";
  summary: string;
}
```

---

### `rofiConfirm(title: string, message: string, severity: Severity): Promise<boolean>`

Show confirmation dialog.

**Location:** `src/security/confirmation.ts`

**Returns:** `Promise<boolean>` - User confirmation

---

## 🎨 UI Module

### Rofi Integration

**Location:** `src/ui/rofi.ts`

```typescript
import { rofiSelect, rofiInput, rofiConfirm } from "./ui";
```

#### `rofiSelect(options: string[], prompt?: string): Promise<string | null>`

Show selection menu.

#### `rofiInput(prompt: string, initialValue?: string): Promise<string | null>`

Show input field.

#### `rofiConfirm(title: string, message: string, severity?: Severity): Promise<boolean>`

Show confirmation dialog.

---

### Tool Display

**Location:** `src/ui/tool-display.ts`

```typescript
import { formatToolCall, formatToolResult } from "./ui";
```

#### `formatToolCall(tool: string, args: string): string`

Format tool call for display.

#### `formatToolResult(result: string): string`

Format tool result for display.

---

### Loader

**Location:** `src/ui/loader.ts`

```typescript
import { showLoader, hideLoader } from "./ui";
```

#### `showLoader(message?: string): void`

Show loading animation.

#### `hideLoader(): void`

Hide loading animation.

---

## 🛠️ Utilities

### Path Utilities

**Location:** `src/utils/path.ts`

```typescript
import { expandTilde, normalizePath } from "./utils";
```

#### `expandTilde(path: string): string`

Expand `~` to home directory.

```typescript
expandTilde("~/Documents");  // "/home/user/Documents"
```

---

#### `normalizePath(path: string): string`

Normalize path separators.

```typescript
normalizePath("path\\to\\file");  // "path/to/file"
```

---

### Format Utilities

**Location:** `src/utils/format.ts`

```typescript
import { formatFileSize, truncate, formatRelativeTime } from "./utils";
```

#### `formatFileSize(bytes: number): string`

```typescript
formatFileSize(1536000);  // "1.5 MB"
```

---

#### `truncate(text: string, length: number): string`

```typescript
truncate("Long text...", 10);  // "Long te..."
```

---

#### `formatRelativeTime(date: Date): string`

```typescript
formatRelativeTime(new Date());  // "baru saja"
```

---

---

## 📦 Constants

### Command Constants

**Location:** `src/constants/commands.ts`

```typescript
import { DANGEROUS_COMMAND_PATTERNS, COMMAND_TIMEOUT } from "./constants";
```

| Constant | Value | Description |
|----------|-------|-------------|
| `COMMAND_TIMEOUT` | `30000` | Command timeout (ms) |
| `DANGEROUS_COMMAND_PATTERNS` | `object` | Pattern definitions |

---

### Model Constants

**Location:** `src/constants/models.ts`

```typescript
import { DEFAULT_FALLBACK_MODELS, GROQ_API_ENDPOINT } from "./constants";
```

| Constant | Value |
|----------|-------|
| `GROQ_API_ENDPOINT` | `"https://api.groq.com/openai/v1/chat/completions"` |
| `DEFAULT_FALLBACK_MODELS` | `["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b"]` |

---

### Settings Constants

**Location:** `src/types/settings.ts`

```typescript
import { DEFAULT_SETTINGS } from "./types";
```

```typescript
{
  features: {
    tts: false;
    toolDisplay: true;
    chatHistory: true;
    windowContext: true;
  }
}
```

---

## 📐 Types

### AI Types

**Location:** `src/types/ai.ts`

```typescript
interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ModelConfig {
  name: string;
  temperature: number;
  maxTokens: number;
}
```

---

### Chat Types

**Location:** `src/types/chat.ts`

```typescript
interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  createdAt: Date;
  updatedAt: Date;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ToolCall {
  tool: string;
  args: string;
  timestamp: Date;
}

interface ToolResult {
  tool: string;
  result: string;
  timestamp: Date;
}
```

---

### Tool Types

**Location:** `src/types/tool.ts`

```typescript
type ToolHandler = (args: string) => Promise<string>;

interface ParsedToolCall {
  tool: string;
  args: string;
  raw: string;
}

interface ToolRegistry {
  [name: string]: ToolHandler;
}
```

---

### Settings Types

**Location:** `src/types/settings.ts`

```typescript
interface Settings {
  features: FeatureFlags;
}

interface FeatureFlags {
  tts: boolean;
  toolDisplay: boolean;
  chatHistory: boolean;
  windowContext: boolean;
}
```

---

### Error Types

**Location:** `src/types/index.ts`

```typescript
class ModelNotFoundError extends Error {
  constructor(model: string);
}

class AllModelsFailedError extends Error {
  constructor(models: string[], lastError: Error);
}
```

---

## 🧪 Testing

### Bun Test API

```typescript
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
```

### Test Structure

```typescript
describe("ModuleName", () => {
  beforeEach(() => {
    // Setup before each test
  });

  test("should do something", () => {
    const result = functionToTest();
    expect(result).toBe(expectedValue);
  });

  test("should handle async", async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });
});
```

### Common Matchers

```typescript
expect(value).toBe(expected);           // Strict equality
expect(value).toEqual(expected);        // Deep equality
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(5);
expect(string).toContain("substring");
expect(array).toContain(item);
expect(object).toHaveProperty("key");
expect(fn).toThrow();
expect(mockFn).toHaveBeenCalled();
```

### Mocking

```typescript
const mockFn = mock((x: number) => x * 2);
const result = mockFn(5);

expect(mockFn).toHaveBeenCalledWith(5);
expect(mockFn).toHaveBeenCalledTimes(1);
```

### Running Tests

```bash
bun test                    # Run all tests
bun test tests/security.test.ts  # Specific file
bun test --watch            # Watch mode
bun test --coverage         # Coverage report
bun test --verbose          # Verbose output
```

---

## 🔗 Related Documentation

- [Development Guide](./DEVELOPMENT.md) - Development workflow
- [Tools Documentation](./TOOLS.md) - Detailed tool usage
- [Security Documentation](./SECURITY.md) - Security features
- [Testing Guide](./TESTING.md) - Testing documentation

---

<div align="center">

**API Reference** - DeskLumina Core Modules

*Last updated: March 2026*

</div>
