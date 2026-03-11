# 🛠️ Development Guide

This guide provides essential information for developers working on DeskLumina.

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Conventions](#code-conventions)
- [TypeScript Configuration](#typescript-configuration)
- [Linting & Type Checking](#linting--type-checking)
- [Debugging](#debugging)
- [Contributing](#contributing)

---

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Bun](https://bun.sh) | v1.3.9+ | JavaScript runtime |
| BSPWM | Latest | Window manager |
| Rofi | Latest | UI launcher |

### Setup

```bash
# Clone the repository
git clone https://github.com/Rafacuy/desklumina.git
cd desklumina

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Edit .env with your Groq API key
nano .env
```

### Available Scripts

```bash
# Type check (lint)
bun run lint

# Development mode with watch
bun run dev

# Production start
bun start

# Run with custom command
bun run src/main.ts --exec "open telegram"
```

---

## 🏗️ Project Structure

```
agent/
├── src/
│   ├── main.ts                    # Entry point
│   │
│   ├── ai/                        # AI integration
│   │   ├── groq.ts                # Groq API streaming
│   │   ├── prompts.ts             # System prompts
│   │   ├── stream.ts              # SSE parser
│   │   └── tts.ts                 # Text-to-speech
│   │
│   ├── config/                    # Configuration
│   │   ├── apps.json              # App aliases
│   │   └── env.ts                 # Env validation
│   │
│   ├── constants/                 # Constants
│   │   ├── commands.ts            # Dangerous patterns
│   │   ├── index.ts               # Barrel export
│   │   └── models.ts              # Model configs
│   │
│   ├── core/                      # Business logic
│   │   ├── chat-manager.ts        # Chat persistence
│   │   ├── context.ts             # Context tracking
│   │   ├── index.ts               # Barrel export
│   │   ├── lumina.ts              # AI orchestration
│   │   ├── planner.ts             # Tool planning
│   │   └── settings-manager.ts    # Settings
│   │
│   ├── logger/                    # Logging
│   │   ├── index.ts               # Logger instance
│   │   └── types.ts               # Logger types
│   │
│   ├── security/                  # Security
│   │   ├── confirmation.ts        # Confirmation dialogs
│   │   ├── dangerous-commands.ts  # Pattern analysis
│   │   └── index.ts               # Barrel export
│   │
│   ├── tools/                     # Tool handlers
│   │   ├── apps.ts                # App launcher
│   │   ├── bspwm.ts               # Window manager
│   │   ├── clipboard.ts           # Clipboard
│   │   ├── files.ts               # File ops
│   │   ├── media.ts               # MPD control
│   │   ├── notify.ts              # Notifications
│   │   ├── registry.ts            # Tool registry
│   │   ├── terminal.ts            # Shell execution
│   │   └── window-info.ts         # Window context
│   │
│   ├── ui/                        # UI components
│   │   ├── loader.ts              # Loading animation
│   │   ├── rofi.ts                # Rofi integration
│   │   ├── settings.ts            # Settings menu
│   │   ├── tool-display.ts        # Tool formatting
│   │   └── themes/                # Rofi themes
│   │
│   └── utils/                     # Utilities
│       ├── format.ts              # Formatters
│       ├── index.ts               # Barrel export
│       ├── log-viewer.ts          # Log viewer
│       └── path.ts                # Path utilities
│
├── docs/                          # Documentation
│   ├── API.md                     # API reference
│   ├── DEVELOPMENT.md             # This file
│   ├── SECURITY.md                # Security docs
│   └── TOOLS.md                   # Tool docs
│
├── chats/                         # Chat history
├── logs/                          # Log files
├── .env.example                   # Environment template
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
└── settings.json                  # Feature flags
```

---

## 💻 Development Workflow

### 1. Make Changes

Edit source files in `src/`. The codebase uses:

- **ES modules** for imports/exports
- **Async/await** for async operations
- **Template literals** for string interpolation

### 2. Type Check

Run the linter (type checker) before committing:

```bash
bun run lint
```

This runs `tsc --noEmit` to check for type errors without building.

### 3. Test Changes

**Interactive mode (Rofi UI):**
```bash
bun start
```

**Terminal chat mode:**
```bash
bun run dev
```

**Direct execution:**
```bash
bun run src/main.ts --exec "your command"
```

### 4. Debug

Logs are written to `~/.config/bspwm/agent/logs/`. View them with:

```bash
# View latest logs
tail -f ~/.config/bspwm/agent/logs/agent.log

# Or use the log viewer
bun run src/utils/log-viewer.ts
```

### 5. Commit

```bash
git add .
git commit -m "Description of changes"
git push
```

---

## 📝 Code Conventions

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `chatManager`, `isDangerous` |
| Functions | camelCase | `buildSystemPrompt()`, `execute()` |
| Classes | PascalCase | `Lumina`, `ChatManager` |
| Types/Interfaces | PascalCase | `AIMessage`, `ToolCall` |
| Constants | UPPER_SNAKE_CASE | `COMMAND_TIMEOUT`, `DEFAULT_SETTINGS` |
| Files | lowercase with hyphens | `chat-manager.ts`, `groq.ts` |

### Code Style

**Imports:** Group by type (external, internal, relative)

```typescript
// External packages
import { exec } from "bun:shell";
import EdgeTTS from "edge-tts-universal";

// Internal modules
import { logger } from "../logger";
import { ChatManager } from "../core";

// Relative imports
import { formatResult } from "./utils";
```

**Async Functions:** Always use explicit return types

```typescript
export async function streamGroq(
  messages: AIMessage[]
): AsyncGenerator<string> {
  // Implementation
}
```

**Error Handling:** Use try-catch with proper logging

```typescript
try {
  const result = await execute(command);
  return result.stdout;
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("files", `Operation failed: ${err.message}`, err);
  return `❌ Error: ${err.message}`;
}
```

**Tool Handlers:** Return `Promise<string>`

```typescript
export async function clipboard(action: string): Promise<string> {
  logger.info("clipboard", `Action: ${action}`);
  
  try {
    // Implementation
    return "✓ Success";
  } catch (error) {
    return `❌ Error: ${error}`;
  }
}
```

### TypeScript Configuration

Key settings from `tsconfig.json`:

| Setting | Value | Description |
|---------|-------|-------------|
| `target` | ES2022 | Modern JavaScript features |
| `module` | ESNext | ES module system |
| `moduleResolution` | bun | Bun-specific resolution |
| `strict` | true | Full type safety |
| `noUncheckedIndexedAccess` | true | Safer array indexing |
| `skipLibCheck` | true | Faster compilation |

---

## 🔧 Linting & Type Checking

### Running the Linter

```bash
bun run lint
```

This executes:
```bash
bun x tsc --noEmit
```

### What It Checks

- ✅ Type correctness
- ✅ Missing properties
- ✅ Incorrect function arguments
- ✅ Unused variables
- ✅ Promise handling
- ✅ Null/undefined checks

### Common Errors & Fixes

**Index access error:**
```typescript
// ❌ Error: Element may be undefined
const first = args[0];

// ✅ Fix: Check for undefined
const first = args[0];
if (!first) return "❌ Missing argument";
```

**Missing return type:**
```typescript
// ❌ Error: Implicit any
async function handler(action) { }

// ✅ Fix: Add explicit types
async function handler(action: string): Promise<string> { }
```

---

## 🐛 Debugging

### Logging

The logger module provides structured logging:

```typescript
import { logger } from "./logger";

logger.info("files", "Operation started");
logger.warn("bspwm", "Window not found");
logger.error("groq", "API request failed", error);
```

### Log Levels

| Level | Description | Color |
|-------|-------------|-------|
| `info` | General information | Blue |
| `warn` | Warnings | Yellow |
| `error` | Errors | Red |
| `success` | Success messages | Green |

### Viewing Logs

**File location:**
```
~/.config/bspwm/agent/logs/
├── agent.log          # Main log
├── agent-error.log    # Error-only log
└── agent-YYYY-MM-DD.log  # Daily logs
```

**Using log viewer:**
```bash
bun run src/utils/log-viewer.ts
```

**Manual viewing:**
```bash
tail -f ~/.config/bspwm/agent/logs/agent.log
```

---

## 🧪 Testing

### Manual Testing

Test individual tools:

```typescript
// Test file operations
bun run src/main.ts --exec "list files in ~/Downloads"

// Test BSPWM
bun run src/main.ts --exec "switch to workspace 3"

// Test media
bun run src/main.ts --exec "toggle music playback"
```

### Error Testing

See `test-error-handling.ts` for error handling test patterns.

---

## 📚 Additional Documentation

| Document | Description |
|----------|-------------|
| [API.md](./API.md) | Core API reference |
| [TOOLS.md](./TOOLS.md) | Tool system documentation |
| [SECURITY.md](./SECURITY.md) | Security features |

---

## 🤝 Contributing

### Before Contributing

1. Ensure type checking passes: `bun run lint`
2. Test your changes manually
3. Update documentation if needed
4. Write clear commit messages

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Example:**
```
feat(tools): add wait_and_move action to bspwm tool

- Implement window waiting logic
- Add timeout handling
- Update tool registry

Closes #42
```

---

## 🔗 Resources

- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Groq API Docs](https://console.groq.com/docs)
- [BSPWM Manual](https://github.com/baskerville/bspwm)

---

<div align="center">

**Need help?** Check out the [API Reference](./API.md) or [Tool Documentation](./TOOLS.md).

</div>
