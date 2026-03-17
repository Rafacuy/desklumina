# 05 - Architecture

This document provides a comprehensive overview of DeskLumina's system architecture, module organization, and data flow.

---

## System Overview

DeskLumina is built as a modular system with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           User Interface Layer                           │
│                    (Rofi / Terminal / Daemon Client)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             Core Layer                                   │
│              (Lumina / ChatManager / ContextTracker)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────┐
│      AI Layer         │ │   Security Layer  │ │     Tools Layer       │
│  (Groq / TTS / Prompts)│ │(Confirmation /    │ │(Apps / BSPWM / Files  │
│                       │ │Dangerous Commands)│ │Media / Clipboard)     │
└───────────────────────┘ └───────────────────┘ └───────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Desktop Environment                             │
│              (BSPWM / Rofi / Dunst / MPD / Clipcat)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Module Structure

### Directory Layout

```
src/
├── main.ts                 # Entry point, mode routing
│
├── ai/                     # AI Integration
│   ├── groq.ts            # Groq API streaming
│   ├── prompts.ts         # System prompt builder
│   ├── stream.ts          # SSE parser
│   └── tts.ts             # Text-to-speech
│
├── config/                 # Configuration
│   ├── apps.json          # Application aliases
│   └── env.ts             # Environment validation
│
├── constants/              # Static Values
│   ├── commands.ts        # Dangerous patterns, timeouts
│   ├── models.ts          # AI model configs
│   └── index.ts           # Barrel export
│
├── core/                   # Business Logic
│   ├── lumina.ts          # Main orchestrator
│   ├── chat-manager.ts    # Chat persistence
│   ├── context.ts         # Window context tracking
│   ├── planner.ts         # Tool call parsing
│   └── settings-manager.ts # Settings handling
│
├── daemon/                 # Background Service
│   ├── daemon.ts          # Unix socket server
│   └── index.ts           # Client library
│
├── logger/                 # Logging System
│   ├── index.ts           # Logger instance
│   └── types.ts           # Log types
│
├── security/               # Security Features
│   ├── confirmation.ts    # Rofi confirmation dialogs
│   ├── dangerous-commands.ts # Pattern analysis
│   └── index.ts           # Barrel export
│
├── tools/                  # Desktop Automation
│   ├── apps.ts            # Application launcher
│   ├── bspwm.ts           # Window management
│   ├── clipboard.ts       # Clipboard operations
│   ├── files.ts           # File operations
│   ├── media.ts           # Media control
│   ├── notify.ts          # Notifications
│   ├── terminal.ts        # Shell execution
│   ├── window-info.ts     # Window context
│   └── registry.ts        # Tool registry
│
├── ui/                     # User Interface
│   ├── rofi.ts            # Rofi integration
│   ├── loader.ts          # Loading animation
│   ├── tool-display.ts    # Tool formatting
│   ├── settings.ts        # Settings menu
│   └── themes/            # Rofi themes
│
├── utils/                  # Utilities
│   ├── format.ts          # Formatters
│   ├── path.ts            # Path utilities
│   ├── log-viewer.ts      # Log viewer
│   └── index.ts           # Barrel export
│
├── locales/                # Internationalization
│   └── dictionary.json    # Translation dictionary
│
└── types/                  # TypeScript Types
    ├── ai.ts
    ├── chat.ts
    ├── settings.ts
    └── tool.ts
```

---

## Core Components

### Lumina (Main Orchestrator)

**File:** `src/core/lumina.ts`

The central coordinator that:
- Receives user input
- Manages AI conversation
- Coordinates tool execution
- Handles streaming responses

```typescript
class Lumina {
  constructor(chatManager: ChatManager) {}

  async chat(prompt: string, onChunk?: Function): Promise<void> {
    // 1. Get window context
    // 2. Build system prompt
    // 3. Stream AI response
    // 4. Execute tool calls
    // 5. Return results
  }
}
```

### ChatManager

**File:** `src/core/chat-manager.ts`

Handles conversation persistence:
- Creates and manages chat sessions
- Stores messages and tool calls
- Auto-generates chat titles
- Persists to disk

### ContextTracker

**File:** `src/core/context.ts`

Provides environmental context:
- Detects active window
- Extracts window class and title
- Formats context for AI

### Planner

**File:** `src/core/planner.ts`

Parses AI responses for tool calls:
- Extracts JSON from markdown
- Validates tool call format
- Returns structured tool requests

---

## AI Layer

### Groq Integration

**File:** `src/ai/groq.ts`

Streaming communication with Groq API:

```typescript
async function* streamGroq(messages: AIMessage[]): AsyncGenerator<string> {
  // 1. Build request with model config
  // 2. Make HTTP request to Groq API
  // 3. Parse SSE stream
  // 4. Yield text chunks
  // 5. Handle model fallback on error
}
```

### Model Fallback

When the primary model fails, the system automatically tries fallback models:

```
Primary Model (MODEL_NAME)
        │
        ▼ (error)
Fallback Model 1
        │
        ▼ (error)
Fallback Model 2
        │
        ▼ (error)
AllModelsFailedError
```

### System Prompt

**File:** `src/ai/prompts.ts`

Builds the system prompt including:
- Tool definitions and schemas
- Response format instructions
- Current window context
- Available BSPWM workspaces

---

## Tools Layer

### Tool Registry

All tools are registered in a central registry:

```typescript
// src/tools/registry.ts
const toolRegistry: Record<string, ToolHandler> = {
  app: app,
  terminal: terminal,
  bspwm: bspwm,
  file: fileOp,
  media: media,
  clipboard: clipboard,
  notify: notify
};
```

### Tool Handler Signature

All tools follow a consistent interface:

```typescript
type ToolHandler = (args: string) => Promise<string>;
```

### Tool Execution Flow

```
User Input: "open telegram"
        │
        ▼
AI Response: {"tool": "app", "args": "telegram"}
        │
        ▼
Planner.parseToolCalls() → ParsedToolCall[]
        │
        ▼
dispatchTool("app", "telegram")
        │
        ▼
app("telegram") → "✓ Telegram launched"
```

---

## Security Layer

### Command Analysis

Before execution, commands are analyzed:

```typescript
interface CommandAnalysis {
  isDangerous: boolean;
  highestSeverity: "safe" | "medium" | "high" | "critical";
  summary: string;
}
```

### Severity Actions

| Severity | Action |
|----------|--------|
| Safe | Execute immediately |
| Medium | Log warning, execute |
| High | Require confirmation |
| Critical | Require explicit confirmation |

---

## Daemon Architecture

### Communication Model

```
┌─────────────────┐         ┌─────────────────┐
│    Client       │         │    Daemon       │
│  (bun run send) │         │  (Background)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │   HTTP over Unix Socket   │
         │◄─────────────────────────►│
         │                           │
         │  GET /?cmd=open%20tg      │
         │──────────────────────────►│
         │                           │
         │  {"success": true, ...}   │
         │◄──────────────────────────│
         │                           │
```

### Socket Protocol

- **Transport:** Unix Domain Socket
- **Protocol:** HTTP/1.1
- **Request:** `GET /?cmd=<url_encoded_command>`
- **Response:** JSON

---

## Data Flow

### Complete Request Flow

```
1. User Input
   └── Terminal / Rofi / Daemon Client

2. Core Processing
   ├── ChatManager.addMessage()
   ├── ContextTracker.getContext()
   └── Lumina.chat()

3. AI Processing
   ├── buildSystemPrompt()
   ├── streamGroq()
   └── Parse SSE stream

4. Tool Execution
   ├── Planner.parseToolCalls()
   ├── Security Analysis
   ├── Confirmation (if needed)
   └── Tool execution

5. Response
   ├── Stream to UI
   ├── TTS (if enabled)
   └── Save to chat history
```

---

## Data Persistence

### Chat Storage

```
~/.config/bspwm/agent/chats/
├── chat-abc123.json
├── chat-def456.json
└── ...
```

### Chat File Structure

```json
{
  "id": "chat-abc123",
  "title": "Desktop Setup",
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."}
  ],
  "toolCalls": [...],
  "toolResults": [...],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

---

## Type Definitions

### AI Types

```typescript
interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

### Chat Types

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
```

### Tool Types

```typescript
interface ParsedToolCall {
  tool: string;
  args: string;
  raw: string;
}

type ToolHandler = (args: string) => Promise<string>;
```

---

## Configuration Flow

```
.env                    → Environment Variables
        │
        ▼
src/config/env.ts       → Validation & Export
        │
        ▼
src/ai/groq.ts          → API Configuration

settings.json           → User Preferences
        │
        ▼
src/core/settings-manager.ts → Load & Validate
        │
        ▼
Feature flags applied throughout application
```

---

## Next Steps

- **[Usage Guide](06-usage-guide.md)** — Learn how to use all features
- **[API Reference](08-api-reference.md)** — Detailed API documentation
- **[Development Guide](10-development.md)** — Contribute to the project

---

← Previous: [Configuration](04-configuration.md) | Next: [Usage Guide](06-usage-guide.md) →
