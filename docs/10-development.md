# 10 - Development Guide

This guide provides essential information for developers working on DeskLumina.

---

## Development Setup

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Bun](https://bun.sh) | v1.3.9+ | JavaScript runtime |
| BSPWM | Latest | Window manager |
| Rofi | Latest | UI launcher |

### Initial Setup

```bash
# Clone the repository to your BSPWM agent config directory
git clone https://github.com/Rafacuy/desklumina.git ~/.config/bspwm/agent
cd ~/.config/bspwm/agent

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Edit .env with your Groq API key
nano .env
```

---

## Available Scripts

```bash
# Type check (lint)
bun run lint

# Development mode with watch
bun run dev

# Production start
bun start

# Run with custom command
bun run src/main.ts --exec "open telegram"

# Daemon mode
bun run daemon

# Send command to daemon
bun run send "your command"

# Check daemon status
bun run daemon:status

# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

---

## Project Structure

```
src/
├── main.ts                 # Entry point
│
├── ai/                     # AI integration
│   ├── groq.ts            # Groq API streaming
│   ├── prompts.ts         # System prompts
│   ├── stream.ts          # SSE parser
│   └── tts.ts             # Text-to-speech
│
├── config/                 # Configuration
│   ├── apps.json          # App aliases
│   └── env.ts             # Env validation
│
├── constants/              # Constants
│   ├── commands.ts        # Dangerous patterns
│   ├── models.ts          # Model configs
│   └── index.ts           # Barrel export
│
├── core/                   # Business logic
│   ├── chat-manager.ts    # Chat persistence
│   ├── context.ts         # Context tracking
│   ├── lumina.ts          # AI orchestration
│   ├── planner.ts         # Tool planning
│   └── settings-manager.ts # Settings
│
├── daemon/                 # Daemon mode
│   ├── daemon.ts          # Daemon server
│   └── index.ts           # Daemon client
│
├── logger/                 # Logging
│   ├── index.ts           # Logger instance
│   └── types.ts           # Logger types
│
├── security/               # Security
│   ├── confirmation.ts    # Confirmation dialogs
│   ├── dangerous-commands.ts # Pattern analysis
│   └── index.ts           # Barrel export
│
├── tools/                  # Tool handlers
│   ├── apps.ts            # App launcher
│   ├── bspwm.ts           # Window manager
│   ├── clipboard.ts       # Clipboard
│   ├── files.ts           # File ops
│   ├── media.ts           # MPD control
│   ├── notify.ts          # Notifications
│   ├── terminal.ts        # Shell execution
│   ├── window-info.ts     # Window context
│   └── registry.ts        # Tool registry
│
├── ui/                     # UI components
│   ├── loader.ts          # Loading animation
│   ├── rofi.ts            # Rofi integration
│   ├── settings.ts        # Settings menu
│   ├── tool-display.ts    # Tool formatting
│   └── themes/            # Rofi themes
│
├── utils/                  # Utilities
│   ├── format.ts          # Formatters
│   ├── index.ts           # Barrel export
│   ├── log-viewer.ts      # Log viewer
│   └── path.ts            # Path utilities
│
├── locales/                # i18n
│   └── dictionary.json    # Translations
│
└── types/                  # TypeScript types
    ├── ai.ts
    ├── chat.ts
    ├── settings.ts
    └── tool.ts
```

---

## Code Conventions

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
  logger.error("module", `Operation failed: ${err.message}`, err);
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

---

## Internationalization (i18n)

DeskLumina uses a centralized translation system. Never hardcode user-facing strings.

### Using the t() Function

```typescript
import { t } from "./utils";

// ❌ BAD
console.log("Searching for files...");

// ✅ GOOD
console.log(t("Searching for files..."));
```

### Dictionary Location

All strings are in `src/locales/dictionary.json`.

### Automated Refactoring

```bash
bun run i18n:refactor
```

---

## TypeScript Configuration

Key settings from `tsconfig.json`:

| Setting | Value | Description |
|---------|-------|-------------|
| `target` | ES2022 | Modern JavaScript features |
| `module` | ESNext | ES module system |
| `moduleResolution` | bun | Bun-specific resolution |
| `strict` | true | Full type safety |
| `noUncheckedIndexedAccess` | true | Safer array indexing |

---

## Type Checking

```bash
bun run lint
```

This runs `tsc --noEmit` to check for type errors.

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

## Debugging

### Logging

```typescript
import { logger } from "./logger";

logger.info("module", "Operation started");
logger.warn("module", "Warning message");
logger.error("module", "Error message", error);
```

### Log Levels

| Level | Description | Color |
|-------|-------------|-------|
| `info` | General information | Blue |
| `warn` | Warnings | Yellow |
| `error` | Errors | Red |
| `success` | Success messages | Green |

### Viewing Logs

```bash
tail -f ~/.config/bspwm/agent/logs/general.log
```

---

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/security.test.ts

# Watch mode
bun test --watch

# Coverage report
bun test --coverage
```

### Test Files

| File | Description |
|------|-------------|
| `chat-manager.test.ts` | Chat management |
| `constants.test.ts` | Constants validation |
| `env.test.ts` | Environment config |
| `logger.test.ts` | Logger functionality |
| `path.test.ts` | Path utilities |
| `security.test.ts` | Security detection |
| `tools.test.ts` | Tool handlers |
| `daemon.test.ts` | Daemon mode |

See [Testing Guide](12-testing.md) for details.

---

## Pre-commit Checklist

- [ ] Type checking passes (`bun run lint`)
- [ ] Tests pass (`bun test`)
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Clear commit messages

---

## Commit Message Format

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

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Groq API Docs](https://console.groq.com/docs)
- [BSPWM Manual](https://github.com/baskerville/bspwm)

---

## Related Documentation

- **[API Reference](08-api-reference.md)** — Core API documentation
- **[Testing Guide](12-testing.md)** — Testing documentation
- **[Contributing](15-contributing.md)** — Contribution guidelines

---

← Previous: [Security](09-security.md) | Next: [Daemon Mode](11-daemon-mode.md) →