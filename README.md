# DeskLumina

**AI-Powered Desktop Automation Agent for BSPWM**

Control your Linux desktop with natural language commands.

> **Base Path:** This documentation assumes DeskLumina is installed at `~/.config/bspwm/agent/`

[![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e5?style=flat-square&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## Overview

DeskLumina is an intelligent desktop automation agent that lets you control your BSPWM-based Linux desktop using natural language. Built with Bun and TypeScript, it leverages the Groq API for fast AI inference and provides seamless integration with your desktop environment.

> **Note:** This application is designed specifically for the [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) configuration.

---

## Features

- **Natural Language Control** — Communicate with your desktop using everyday language
- **BSPWM Integration** — Full window and workspace management
- **AI Streaming** — Real-time responses via Groq API with automatic model fallback
- **Context Awareness** — Automatic detection of active window for context-aware commands
- **Desktop Integration** — Launch apps, control media, manage files, send notifications
- **Security First** — Dangerous command detection with confirmation prompts
- **Multiple Modes** — Interactive Rofi UI, terminal chat, direct execution, daemon mode
- **Chat History** — Persistent conversations with auto-generated titles
- **Text-to-Speech** — Optional voice responses with Edge TTS

---

## Quick Start

### Prerequisites

- Bun v1.3.9+
- BSPWM window manager
- Rofi, Dunst, Clipcat, MPD+MPC

### Installation

```bash
# Clone the repository to your BSPWM agent config directory
git clone https://github.com/Rafacuy/desklumina.git ~/.config/bspwm/agent
cd ~/.config/bspwm/agent

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your Groq API key
```

### Basic Usage

```bash
# Interactive mode (Rofi UI)
bun start

# Terminal chat mode
bun run dev

# Direct command execution
bun run src/main.ts --exec "open telegram"

# Daemon mode (background service)
bun run daemon
bun run send "switch to workspace 3"
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Introduction](docs/01-introduction.md) | Project overview and philosophy |
| [Installation](docs/02-installation.md) | Detailed setup instructions |
| [Quick Start](docs/03-quick-start.md) | First-time usage guide |
| [Configuration](docs/04-configuration.md) | Settings and customization |
| [Usage Guide](docs/06-usage-guide.md) | All usage modes explained |
| [Tools Reference](docs/07-tools-reference.md) | Complete tool documentation |
| [API Reference](docs/08-api-reference.md) | Core module documentation |
| [Development](docs/10-development.md) | Development workflow |

---

## Contributing

Contributions are welcome! Please read the [Contributing Guide](docs/15-contributing.md) for details on:

- Code conventions
- Development workflow
- Testing requirements
- Pull request process

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with:

- [Bun](https://bun.sh) — Fast JavaScript runtime
- [Groq API](https://groq.com) — Ultra-fast LLM inference
- [BSPWM](https://github.com/baskerville/bspwm) — Tiling window manager
- [Rofi](https://github.com/davatorium/rofi) — Window switcher/launcher

---

Made with ❤️ by [Rafacuy](https://github.com/Rafacuy)