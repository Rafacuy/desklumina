<div align="center">

# 🌟 DeskLumina

**AI-Powered Desktop Automation Agent for BSPWM**

*Control your desktop with natural language*

[![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e5?style=flat-square&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## ⚠️ Important Notice

> **This application is designed specifically for the [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) configuration.**
>
> Please ensure you have the dotfiles installed before using DeskLumina.

---

## 📖 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Documentation](#-documentation)
- [Acknowledgments](#-acknowledgments)

---

## ✨ Features

| Category | Features |
|----------|----------|
| **🤖 AI Integration** | Natural language control, streaming responses via Groq API, automatic model fallback |
| **🖥️ Window Manager** | Full BSPWM integration - workspaces, windows, layouts, focus management |
| **🪟 Context Awareness** | Automatic detection of active window/application for context-aware commands |
| **🚀 Applications** | Launch apps with simple aliases, detached process support |
| **📁 File Operations** | Create, move, copy, delete, search files with safety checks |
| **🎵 Media Control** | MPD integration - play, pause, volume, playlists |
| **📋 Clipboard** | Clipcat clipboard management |
| **🔔 Notifications** | Dunst notifications with urgency levels |
| **💬 Chat History** | Persistent conversations with auto-generated titles |
| **🔊 Text-to-Speech** | Edge TTS with Indonesian voices (Gadis/Ardi) |
| **🎨 UI** | Rofi-based graphical interface with theme support |
| **🔒 Security** | Dangerous command detection, confirmation prompts |

---

## 🚀 Quick Start

### Prerequisites

- **Bun** v1.3.9+
- **BSPWM** window manager
- **Rofi**, **Dunst**, **Clipcat**, **MPD+MPC**

> 💡 This app is designed for [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles).

### Installation

```bash
# Clone and install
git clone https://github.com/Rafacuy/desklumina.git
cd desklumina
bun install

# Configure environment
cp .env.example .env
# Edit .env with your Groq API key
```

### Run

```bash
# Interactive mode (Rofi UI)
bun start

# Terminal chat mode
bun run dev

# Direct command
bun run src/main.ts --exec "open telegram"

# Daemon mode (background service)
bun run daemon

# Send command to daemon
bun run send "open telegram"
```

---

## 🚀 Usage

### Modes

| Mode | Command | Description |
|------|---------|-------------|
| **Interactive (Rofi)** | `bun start` | Graphical interface |
| **Terminal Chat** | `bun run dev` | CLI-based conversation |
| **Direct** | `bun run src/main.ts --exec "command"` | Single command |
| **Daemon** | `bun run daemon` | Background service |
| **Send to Daemon** | `bun run send "command"` | Send to background service |

### Chat Commands

| Command | Description |
|---------|-------------|
| `exit` | Close the application |
| `new` | Start a new chat session |
| `list` | Display all saved chats |
| `load <n>` | Load a specific chat by number |

---

## 🔧 Tool System

DeskLumina uses **JSON-based tool calls** for desktop automation.

### Available Tools

| Tool | Description |
|------|-------------|
| `app` | Launch applications by alias |
| `terminal` | Execute shell commands |
| `bspwm` | Window/workspace management |
| `file` | File operations |
| `media` | Music player control |
| `clipboard` | Clipboard management |
| `notify` | Desktop notifications |

### Example

```json
{"tool": "app", "args": "telegram"}
```

> 📚 **See [Tools Documentation](docs/TOOLS.md) for complete tool reference.**

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Development Guide](docs/DEVELOPMENT.md) | Setup, workflow, conventions |
| [API Reference](docs/API.md) | Core classes and functions |
| [Tools Documentation](docs/TOOLS.md) | Tool system and usage |
| [Security Documentation](docs/SECURITY.md) | Security features |
| [Daemon Mode](docs/DAEMON.md) | Background service setup |
| [Testing Guide](docs/TESTING.md) | Testing with Bun |

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Run specific test
bun test tests/security.test.ts

# With coverage
bun test --coverage

# Watch mode
bun test --watch
```
---

## 🙏 Acknowledgments

Built with:

- [**Bun**](https://bun.sh) - Fast JavaScript runtime
- [**Groq API**](https://groq.com) - Ultra-fast LLM inference
- [**BSPWM**](https://github.com/baskerville/bspwm) - Tiling window manager
- [**Rofi**](https://github.com/davatorium/rofi) - Window switcher/launcher
- [**Dunst**](https://github.com/dunst-project/dunst) - Notification daemon
- [**Clipcat**](https://github.com/xrelkd/clipcat) - Clipboard manager
- [**MPD**](https://www.musicpd.org) - Music player daemon

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ by [Rafacuy](https://github.com/Rafacuy)**

[⬆ Back to Top](#-desklumina)

</div>
