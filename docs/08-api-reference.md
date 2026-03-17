# 08 - API Reference

Complete API reference for DeskLumina's core modules, classes, and functions.

---

## Core Module

### Lumina

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
- `prompt: string` — User's input message
- `onChunk?: (chunk: string) => void` — Optional callback for streaming response

**Example:**
```typescript
const lumina = new Lumina(chatManager);
await lumina.chat("open telegram", (chunk) => {
  process.stdout.write(chunk);
});
```

---

### ChatManager

Manages chat persistence, history, and session management.

**Location:** `src/core/chat-manager.ts`

```typescript
import { ChatManager } from "./core";
```

#### Methods

##### `createChat(firstMessage: string): Chat`

Create a new chat session with auto-generated title.

##### `addMessage(role: "user" | "assistant", content: string): void`

Add a message to the current chat.

##### `getCurrentChat(): Chat | null`

Get the current active chat.

##### `getAllChats(): Chat[]`

Get all saved chats sorted by date.

##### `loadChat(index: number): boolean`

Load a specific chat by index.

##### `newChat(): void`

Start a new chat session.

---

### ContextTracker

Tracks conversation context including active window.

**Location:** `src/core/context.ts`

```typescript
import { ContextTracker } from "./core";
```

#### Methods

##### `getContext(): Promise<WindowContext>`

Get current window context.

##### `formatContext(): string`

Format context for system prompt.

---

### Planner

Parses and plans tool calls from AI responses.

**Location:** `src/core/planner.ts`

```typescript
import { Planner } from "./core";
```

#### Methods

##### `parseToolCalls(content: string): ParsedToolCall[]`

Extract tool calls from AI response markdown.

---

## AI Module

### streamGroq

Stream AI response from Groq API with automatic model fallback.

**Location:** `src/ai/groq.ts`

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

### buildSystemPrompt

Build system prompt with environment context.

**Location:** `src/ai/prompts.ts`

```typescript
import { buildSystemPrompt } from "./ai";

const prompt = await buildSystemPrompt();
```

**Includes:**
- Tool definitions
- Window context
- Environment info
- Response format instructions

---

### TextToSpeech

Text-to-speech using Edge TTS.

**Location:** `src/ai/tts.ts`

```typescript
import { TextToSpeech } from "./ai";

const tts = new TextToSpeech("id-ID-GadisNeural", 1.0);
await tts.speak("Hello World");
```

**Available Voices:**
- `id-ID-GadisNeural` — Female voice
- `id-ID-ArdiNeural` — Male voice

**Speed Options:** `0.5`, `0.75`, `1.0`, `1.25`, `1.5`, `2.0`

---

## Tools Module

### Tool Handler Signature

All tool handlers follow this signature:

```typescript
type ToolHandler = (args: string) => Promise<string>;
```

### App Tool

**Location:** `src/tools/apps.ts`

```typescript
import { app } from "./tools";
await app("telegram");  // → "✓ Telegram launched"
```

### BSPWM Tool

**Location:** `src/tools/bspwm.ts`

```typescript
import { bspwm } from "./tools";
await bspwm("focus_workspace 3");
```

### File Tool

**Location:** `src/tools/files.ts`

```typescript
import { fileOp } from "./tools";
await fileOp("create_dir ~/Test");
```

### Media Tool

**Location:** `src/tools/media.ts`

```typescript
import { media } from "./tools";
await media("toggle");
```

### Clipboard Tool

**Location:** `src/tools/clipboard.ts`

```typescript
import { clipboard } from "./tools";
await clipboard("get");
```

### Notify Tool

**Location:** `src/tools/notify.ts`

```typescript
import { notify } from "./tools";
await notify("Title|Message|normal");
```

---

### Tool Registry

**Location:** `src/tools/registry.ts`

```typescript
import { registerTool, dispatchTool, getRegisteredTools } from "./tools";

// Register a custom tool
registerTool("custom", async (args) => {
  return `Result: ${args}`;
});

// Dispatch a tool call
const result = await dispatchTool("app", "telegram");

// Get all registered tools
const tools = getRegisteredTools();
```

---

## Security Module

### isDangerousCommand

Check if a command matches dangerous patterns.

**Location:** `src/security/dangerous-commands.ts`

```typescript
import { isDangerousCommand } from "./security";

if (isDangerousCommand("rm -rf /")) {
  // Handle dangerous command
}
```

### analyzeCommand

Analyze command for security risks.

```typescript
import { analyzeCommand } from "./security";

const analysis = analyzeCommand("rm file.txt");
// {
//   isDangerous: true,
//   highestSeverity: "high",
//   summary: "File deletion command"
// }
```

### rofiConfirm

Show confirmation dialog.

**Location:** `src/security/confirmation.ts`

```typescript
import { rofiConfirm } from "./security";

const confirmed = await rofiConfirm(
  "Delete File",
  "Are you sure you want to delete?",
  "high"
);
```

---

## UI Module

### Rofi Integration

**Location:** `src/ui/rofi.ts`

```typescript
import { rofiSelect, rofiInput, rofiConfirm } from "./ui";

// Selection menu
const choice = await rofiSelect(["Option 1", "Option 2"], "Select:");

// Input field
const text = await rofiInput("Enter text:");

// Confirmation
const confirmed = await rofiConfirm("Title", "Message", "high");
```

### Loader

**Location:** `src/ui/loader.ts`

```typescript
import { showLoader, stopLoader } from "./ui";

showLoader("Processing...");
// ... do work
stopLoader();
```

### Tool Display

**Location:** `src/ui/tool-display.ts`

```typescript
import { formatToolCall, formatToolResult } from "./ui";

const callDisplay = formatToolCall("app", "telegram");
const resultDisplay = formatToolResult("✓ Success");
```

---

## Utilities

### Path Utilities

**Location:** `src/utils/path.ts`

```typescript
import { expandTilde, normalizePath } from "./utils";

expandTilde("~/Documents");  // → "/home/user/Documents"
normalizePath("path\\to\\file");  // → "path/to/file"
```

### Format Utilities

**Location:** `src/utils/format.ts`

```typescript
import { formatFileSize, truncate, formatRelativeTime } from "./utils";

formatFileSize(1536000);  // → "1.5 MB"
truncate("Long text...", 10);  // → "Long te..."
```

---

## Constants

### Command Constants

**Location:** `src/constants/commands.ts`

```typescript
import { DANGEROUS_COMMAND_PATTERNS, COMMAND_TIMEOUT } from "./constants";

// COMMAND_TIMEOUT = 30000 (ms)
// DANGEROUS_COMMAND_PATTERNS = { ... }
```

### Model Constants

**Location:** `src/constants/models.ts`

```typescript
import { DEFAULT_FALLBACK_MODELS, GROQ_API_ENDPOINT } from "./constants";

// GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
// DEFAULT_FALLBACK_MODELS = ["llama-3.3-70b-versatile", ...]
```

---

## Types

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
  dangerousCommandConfirmation: boolean;
}
```

---

## Error Types

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

## Related Documentation

- **[Tools Reference](07-tools-reference.md)** — Tool usage documentation
- **[Development Guide](10-development.md)** — Development workflow
- **[Architecture](05-architecture.md)** — System design

---

← Previous: [Tools Reference](07-tools-reference.md) | Next: [Security](09-security.md) →