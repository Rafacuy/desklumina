# 06 - Usage Guide

Learn how to master DeskLumina's interactive and terminal interfaces.

---

## Table of Contents

- [Interactive UI (Rofi)](#interactive-ui-rofi)
  - [Main Chat Interface](#main-chat-interface)
  - [Chat History Preview](#chat-history-preview)
  - [Settings Menu](#settings-menu)
- [Terminal Mode](#terminal-mode)
- [CLI Arguments](#cli-arguments)
- [One-Off Commands](#one-off-commands)

---

## Interactive UI (Rofi)

DeskLumina's primary interface is built on **Rofi**.

### Main Chat Interface

**Launch**: `bun run start`

- **Type to Chat**: Type your natural language command and press `Enter`.
- **Tool Display**: If enabled, tool execution summaries are appended under the assistant response.
- **TTS Feedback**: If enabled, the assistant will speak its response concurrently.

### Chat History Preview

**Access**: press `Tab` to expand, then select **Select Chat**.

- Chats are persisted under `~/.config/desklumina/chats/` as JSON files.

### Settings Menu

**Access**: press `Tab` to expand, then select **Settings**.

The settings menu allows you to customize DeskLumina's behavior without editing files:
- **Toggle TTS**: Enable/disable voice output.
- **Language**: Switch between English and Indonesian.
- **Tool Display**: Show/hide tool execution logs.
- **Security Confirmation**: Toggle interactive checks for dangerous commands.
- **TTS Voice & Speed**: Choose a voice and adjust playback speed.

---

## Terminal Mode

Ideal for development, debugging, or users who prefer the terminal environment.

**Launch**: `bun run dev`

- Provides a persistent chat loop directly in your shell.
- Best for long-form conversations where you need to copy/paste text.

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
| `--send "<message>"` | Send a command to the running daemon (requires a message argument). |
| `--exec "<message>"` | Execute a single message and print the assistant response. |
| `--version` | Display the current version and configured model. |

### How to pass flags via Bun scripts

`package.json` runs `src/main.ts` from the `start`/`dev`/`daemon` scripts. To pass flags to `src/main.ts`, use `--`:

```bash
bun run start -- --version
bun run start -- --chat
```

---

## One-Off Commands

You can execute a single desktop action directly from your terminal or a keyboard shortcut without entering an interactive loop.

**Command**: `bun run start -- --exec "your message"`

### Examples:
- `bun run start -- --exec "open telegram"`
- `bun run start -- --exec "file list ~"`
- `bun run start -- --exec "media current"`

> **Pro Tip**: Bind these commands to your desktop's hotkeys (e.g., using `sxhkd` or `i3/sway` config) for instant access.

---

## Next Steps

- 🔧 **[Tools Reference](07-tools-reference.md)** — Comprehensive list of what you can do.
- 🛡️ **[Security](09-security.md)** — Understand how DeskLumina protects your system.
- 🤖 **[Daemon Mode](11-daemon-mode.md)** — Learn about background execution.

---

[← Architecture](05-architecture.md) | [Tools Reference →](07-tools-reference.md)
