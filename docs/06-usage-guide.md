# 06 - Usage Guide

Learn how to master DeskLumina's interactive and terminal interfaces.

---

## Table of Contents

- [Interactive UI (Rofi)](#interactive-ui-rofi)
  - [Main Chat Interface](#main-chat-interface)
  - [Chat History Preview](#chat-history-preview)
  - [Agentic Workflow](#agentic-workflow)
  - [Settings Menu](#settings-menu)
- [Terminal Mode](#terminal-mode)
- [CLI Arguments](#cli-arguments)
- [Multi-Step Tasks](#multi-step-tasks)

---

## Interactive UI (Rofi)

DeskLumina's primary interface is built on **Rofi**.

### Main Chat Interface

**Launch**: `bun run start`

- **Type to Chat**: Type your natural language command and press `Enter`.
- **Tool Display**: If enabled, real-time tool execution updates appear under the assistant response.
- **TTS Feedback**: If enabled, the assistant will speak its final response.

### Chat History Preview

**Access**: Press `Tab` to expand, then select **Select Chat**.

- Chats are saved under `~/.config/desklumina/chats/` as JSON files.

### Agentic Workflow

DeskLumina now uses a ReAct-based agent loop. This means it can:
- **Reason**: Analyze your request and determine which tools are needed.
- **Act**: Execute one or more tools sequentially.
- **Refine**: Use tool results to decide if more steps are required.
- **Self-Correct**: Automatically retry tool calls if transient errors occur.

### Settings Menu

**Access**: Press `Tab` to expand, then select **Settings**.

The settings menu allows you to customize DeskLumina's behavior without editing files:
- **Toggle TTS**: Enable or disable voice output.
- **Language**: Switch between English, Indonesian, and Japanese.
- **Persona**: Choose an assistant conversational personality.
- **Tool Display**: Show or hide real-time tool execution logs.
- **Security Confirmation**: Toggle interactive checks for dangerous commands.
- **TTS Voice & Speed**: Choose a voice and adjust playback speed.

---

## Terminal Mode

This mode is for development, debugging, or users who prefer the terminal environment.

**Launch**: `bun run dev`

- Provides a persistent chat loop directly in your shell.
- Best for long-form conversations and debugging agent reasoning.

### Terminal Chat Commands

When in terminal mode, use these interactive commands:

| Command | Description |
|---------|-------------|
| `exit` | Quit the chat loop. |
| `new` | Start a new chat session. |
| `list` | Show all saved chats with message counts. |
| `load <number>` | Load a chat session by its number from the `list` output. |

---

## CLI Arguments

DeskLumina supports several CLI flags for different use cases:

| Flag | Description |
|------|-------------|
| `--chat` | Start the terminal chat loop. |
| `--daemon` | Start the background daemon service. |
| `--daemon-status` | Check if the daemon is running. |
| `--send "<message>"` | Send a command to the running daemon. |
| `--exec "<message>"` | Execute a single message through the agent loop. |
| `--version` | Display the current version and configured model. |
| `provider list` | List all registered providers with API keys. |
| `provider current` | Show the currently configured primary model and resolved provider. |

### Passing flags via Bun scripts

`package.json` runs `src/main.ts` from the `start`, `dev`, or `daemon` scripts. To pass flags to `src/main.ts`, use `--`:

```bash
bun run start -- --version
bun run start -- --chat
```

---

## Multi-Step Tasks

The new agent architecture allows for complex, multi-step desktop automation.

**Command**: `bun run start -- --exec "your complex request"`

### Examples:
- "Find the project report in my documents, read it, and summarize the key points."
- "Check if Telegram is running, if not open it, and then clear my clipboard."
- "Calculate the sum of all numbers in a text file and notify me of the result."

The agent will autonomously execute the necessary tools and provide a final synthesis.

---

## Next Steps

- 🔧 **[Tools Reference](07-tools-reference.md)**: Comprehensive list of what you can do.
- 🛡️ **[Security](09-security.md)**: Understand how DeskLumina protects your system.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Learn about background execution.

---

[← Architecture](05-architecture.md) | [Tools Reference →](07-tools-reference.md)
