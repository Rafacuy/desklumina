# 03 - Quick Start

Get started with DeskLumina and run your first commands. This guide covers basic interactions and interaction modes.

---

## Table of Contents

- [First Flight](#first-flight)
- [Interaction Modes](#interaction-modes)
  - [Interactive Mode (Rofi)](#interactive-mode-rofi)
  - [Terminal Mode](#terminal-mode)
  - [One-Off Commands](#one-off-commands)
- [Common Commands](#common-commands)
- [Getting Help](#getting-help)

---

## First Flight

1. Ensure your `.env` file contains `GROQ_API_KEY` and `MODEL_NAME` (see `.env.example`).
2. Open your terminal and run:
   ```bash
   bun run start
   ```
3. A Rofi input box will appear. Type:
   ```text
   open telegram
   ```
4. Press `Enter`. DeskLumina will launch Telegram.

---

## Interaction Modes

### Interactive Mode (Rofi)

This is the recommended way to use DeskLumina for daily tasks. It provides a visual chat history, settings access, and a keyboard-friendly interface.

- **Launch**: `bun run start`
- **Controls**:
  - `Enter`: submit message.
  - `Tab`: toggle expanded menu (shows recent messages, chat selection, settings).
  - `Esc`: exit.

### Terminal Mode

Perfect for developers and power users who are already in the terminal.

- **Launch**: `bun run dev`
- This mode starts a chat loop directly in your terminal with live streaming responses.

### One-Off Commands

Execute a single message without entering a chat loop.

- **Command**: `bun run start -- --exec "your message here"`
- **Example**: `bun run start -- --exec "open telegram"`

---

## Common Commands

Try these commands to explore DeskLumina's capabilities:

### Application Management
- `open browser`
- `launch kitty`

### File Operations
- `list files in ~/Downloads`
- `create a directory called 'Work' on the Desktop`
- `move 'notes.txt' to '~/Documents/'`

### System Controls
- `media volume 50`
- `media next`

### Information & Utility
- `terminal date`
- `terminal uname -a`

---

## Getting Help

DeskLumina is designed to understand natural language. If it doesn't understand a command:
- Try rephrasing (e.g., instead of "kill browser", try "close chrome").
- Use the **[Tools Reference](07-tools-reference.md)** to see precisely what's supported.
- Check the **[Troubleshooting Guide](13-troubleshooting.md)** for common issues.

---

## Next Steps

- ⚙️ **[Configuration Guide](04-configuration.md)** — Fine-tune your setup.
- 🔧 **[Tools Reference](07-tools-reference.md)** — Detailed list of all capabilities.
- 🧠 **[Architecture](05-architecture.md)** — Learn about the internal design.

---

[← Installation](02-installation.md) | [Configuration →](04-configuration.md)
