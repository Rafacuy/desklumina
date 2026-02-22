<div align="center">

# 🌟 DeskLumina

**AI-Powered Desktop Automation Agent for BSPWM**

*Control your desktop with natural language*

[![Bun](https://img.shields.io/badge/Runtime-Bun-000000?style=flat-square&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Beta_Testing-orange?style=flat-square)]()

</div>

---

## ⚠️ Important Notice

> **This application is designed specifically for the [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) configuration.**
> 
> Please ensure you have the dotfiles installed before using DeskLumina.

---

## 📖 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [Tool System](#-tool-system)
- [Model Fallback System](#-model-fallback-system)
- [Configuration](#-configuration)
- [Development](#-development)
- [Security](#-security)
- [Acknowledgments](#-acknowledgments)

---

## ✨ Features

| Category | Features |
|----------|----------|
| **🤖 AI Integration** | Natural language control, streaming responses via Groq API, automatic model fallback |
| **🖥️ Window Manager** | Full BSPWM integration - workspaces, windows, layouts |
| **🚀 Applications** | Launch apps with simple aliases, detached process support |
| **📁 File Operations** | Create, move, copy, delete, search files and directories |
| **🎵 Media Control** | MPD integration - play, pause, volume, playlists |
| **📋 Clipboard** | Clipcat clipboard management and history |
| **🔔 Notifications** | Dunst desktop notifications |
| **💬 Chat History** | Persistent conversations with auto-generated titles |
| **🎨 UI** | Beautiful Rofi-based graphical interface with theme support |

---

## 🏗️ Architecture

```
src/
├── main.ts                    # Entry point with CLI argument handling
│
├── agent/
│   ├── lumina.ts              # Core AI agent orchestration
│   ├── chat-manager.ts        # Chat persistence and history management
│   ├── context.ts             # Conversation context tracking
│   └── planner.ts             # Tool call parsing and planning
│
├── ai/
│   ├── groq.ts                # Groq API streaming with fallback support
│   ├── prompts.ts             # System prompt builder with environment context
│   └── stream.ts              # SSE response parser
│
├── tools/
│   ├── index.ts               # Tool dispatcher registry
│   ├── terminal.ts            # Shell command execution
│   ├── apps.ts                # Application launcher with aliases
│   ├── bspwm.ts               # BSPWM window manager control
│   ├── files.ts               # File system operations
│   ├── media.ts               # MPD music player control
│   ├── clipboard.ts           # Clipcat clipboard management
│   └── notify.ts              # Dunst notification sender
│
├── ui/
│   ├── rofi.ts                # Rofi launcher integration
│   ├── loader.ts              # Loading animation component
│   └── themes/                # Rofi theme configurations
│
├── config/
│   ├── env.ts                 # Environment variable validation & model config
│   └── apps.json              # Application alias mappings
│
└── logger/
    └── index.ts               # Centralized logging system
```

---

## 📦 Installation

### Prerequisites

| Requirement | Description |
|-------------|-------------|
| **Bun** | Runtime v1.3.9 or later |
| **BSPWM** | Tiling window manager |
| **Rofi** | Launcher with custom theme support |
| **Dunst** | Notification daemon |
| **Clipcat** | Clipboard manager |
| **MPD + MPC** | Music player daemon and client |
| **SXHKD** | Keybinding daemon |

### Setup Steps

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/Rafacuy/desklumina.git
   cd desklumina
   bun install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your settings:**
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   MODEL_NAME=openai/gpt-oss-120b
   FALLBACK_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,openai/gpt-oss-20b
   ```

---

## 🚀 Usage

### Interactive Mode (Rofi UI)

Launch the graphical interface:

```bash
bun start
```

### Terminal Chat Mode

Interactive terminal-based conversation:

```bash
bun run dev
```

**Chat Commands:**
| Command | Description |
|---------|-------------|
| `exit` | Close the application |
| `new` | Start a new chat session |
| `list` | Display all saved chats |
| `load <n>` | Load a specific chat by number |

### Direct Execution

Run a single command:

```bash
bun run src/main.ts --exec "open telegram"
```

### Version Check

```bash
bun run src/main.ts --version
```

---

## 🔧 Tool System

Lumina uses XML-style tool calls for desktop automation:

### Available Tools

| Tool | Syntax | Example |
|------|--------|---------|
| `app` | `<tool:app>alias</tool:app>` | `<tool:app>browser</tool:app>` |
| `terminal` | `<tool:terminal>cmd</tool:terminal>` | `<tool:terminal>ls -la</tool:terminal>` |
| `bspwm` | `<tool:bspwm>action</tool:bspwm>` | `<tool:bspwm>focus_workspace 2</tool:bspwm>` |
| `file` | `<tool:file>operation</tool:file>` | `<tool:file>list ~/Downloads</tool:file>` |
| `media` | `<tool:media>action</tool:media>` | `<tool:media>toggle</tool:media>` |
| `clipboard` | `<tool:clipboard>action</tool:clipboard>` | `<tool:clipboard>list</tool:clipboard>` |
| `notify` | `<tool:notify>title\|body\|urgency</tool:notify>` | `<tool:notify>Done\|Task completed\|normal</tool:notify>` |

### Application Aliases

<details>
<summary>📋 View all application aliases</summary>

| Alias | Application |
|-------|-------------|
| `terminal`, `term` | Alacritty terminal |
| `browser` | Default web browser |
| `files`, `thunar` | Thunar file manager |
| `yazi` | Terminal file manager |
| `editor`, `geany` | Geany text editor |
| `neovim`, `nvim` | Neovim in terminal |
| `music`, `ncmpcpp` | NCMPCPP music client |
| `telegram`, `tg` | Telegram Desktop |
| `whatsapp`, `wa` | WhatsApp Web |
| `youtube`, `yt` | YouTube in browser |
| `spotify` | Spotify Web |
| `btop`, `htop` | System monitors |

</details>

### BSPWM Actions

<details>
<summary>🖥️ View BSPWM commands</summary>

| Action | Description |
|--------|-------------|
| `focus_workspace <n>` | Switch to workspace n |
| `move_window_to <n>` | Move window to workspace n |
| `close_focused` | Close focused window |
| `toggle_fullscreen` | Toggle fullscreen mode |
| `toggle_floating` | Toggle floating mode |
| `focus_north/south/east/west` | Focus adjacent windows |
| `rotate_desktop` | Rotate desktop layout |
| `list_workspaces` | List all workspaces |
| `reload_sxhkd` | Reload keybindings |
| `reload_bspwm` | Reload window manager |

</details>

### File Operations

<details>
<summary>📁 View file operations</summary>

| Command | Syntax |
|---------|--------|
| Create directory | `<tool:file>create_dir <path></tool:file>` |
| Delete | `<tool:file>delete <path></tool:file>` |
| Move | `<tool:file>move <src> <dest></tool:file>` |
| Copy | `<tool:file>copy <src> <dest></tool:file>` |
| List | `<tool:file>list <path></tool:file>` |
| Read | `<tool:file>read <path></tool:file>` |
| Write | `<tool:file>write <path> <content></tool:file>` |
| Find | `<tool:file>find <path> <pattern></tool:file>` |

</details>

### Media Control

<details>
<summary>🎵 View media commands</summary>

| Action | Description |
|--------|-------------|
| `play` | Start playback |
| `pause` | Pause playback |
| `toggle` | Toggle play/pause |
| `next` | Next track |
| `prev` | Previous track |
| `stop` | Stop playback |
| `volume <level>` | Set volume level |
| `current` | Show current track |
| `queue` | Show playlist |
| `search <query>` | Search music library |

</details>

---

## 🔄 Model Fallback System

DeskLumina includes an **automatic model fallback system** that ensures continuous operation even if your primary AI model becomes unavailable.

### How It Works

```
┌─────────────────┐
│  Primary Model  │
│   (MODEL_NAME)  │
└────────┬────────┘
         │ ❌ Failed
         ▼
┌─────────────────┐
│ Fallback Model 1│
└────────┬────────┘
         │ ❌ Failed
         ▼
┌─────────────────┐
│ Fallback Model 2│
└────────┬────────┘
         │ ❌ Failed
         ▼
┌─────────────────┐
│ Fallback Model N│
└────────┬────────┘
         │ ❌ All Failed
         ▼
┌─────────────────┐
│   Error Report  │
└─────────────────┘
```

### Configuration

**Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ Yes | Your Groq API key |
| `MODEL_NAME` | ✅ Yes | Primary AI model |
| `FALLBACK_MODELS` | ❌ No | Comma-separated fallback models |

**Default Fallback Models:**

If `FALLBACK_MODELS` is not set, these models are used automatically:
1. `llama-3.3-70b-versatile`
2. `llama-3.1-8b-instant`
3. `openai/gpt-oss-20b`

**Example Configuration:**

```env
# Primary model
MODEL_NAME=openai/gpt-oss-120b

# Custom fallback chain
FALLBACK_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,mixtral-8x7b-32768
```

### Error Handling

| Error Type | Behavior |
|------------|----------|
| Model not found (404) | Automatically tries next fallback |
| Model unavailable (400) | Automatically tries next fallback |
| Rate limit (429) | Tries next fallback |
| Network error | Rethrown immediately |
| All models failed | Returns detailed error with attempted models |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `GROQ_API_KEY` | string | *required* | Groq API authentication key |
| `MODEL_NAME` | string | *required* | Primary AI model identifier |
| `FALLBACK_MODELS` | string | *see above* | Comma-separated fallback models |

### Theme Configuration

Lumina reads the active theme from `~/.config/bspwm/.rice` and applies corresponding Rofi themes from `src/ui/themes/`.

### Chat Storage

Conversations are stored as JSON files in `chats/` directory with:
- Auto-generated titles based on first message
- Full conversation history
- Timestamp metadata

---

## 💻 Development

### Scripts

```bash
# Type checking
bun run lint

# Development mode
bun run dev

# Production start
bun start
```

### Code Conventions

- All tool handlers return `Promise<string>`
- Command timeout: 30 seconds
- Detached processes for app launching
- Centralized logging via logger module
- Strict TypeScript with `noUncheckedIndexedAccess`

### Project Structure Guidelines

```
✅ Do:
- Use TypeScript strict mode
- Follow existing code patterns
- Add proper error handling
- Document new features

❌ Don't:
- Use `any` type
- Skip error handling
- Hardcode configuration
- Ignore timeout protection
```

---

## 🔒 Security

### Safety Measures

| Feature | Description |
|---------|-------------|
| **Confirmation prompts** | Destructive operations require explicit confirmation |
| **Path expansion** | Prevents accidental root directory operations |
| **Timeout protection** | Commands timeout after 30 seconds |
| **Environment variables** | API keys stored in `.env` only |
| **Input validation** | All inputs are sanitized before execution |

### Protected Commands

The following commands require user confirmation:
- `rm -rf` operations
- `kill` commands
- System shutdown/reboot
- Package management operations

---

## 🙏 Acknowledgments

Built with love using:

- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Groq API](https://groq.com) - Ultra-fast LLM inference
- [BSPWM](https://github.com/baskerville/bspwm) - Tiling window manager
- [Rofi](https://github.com/davatorium/rofi) - Window switcher/launcher

---

<div align="center">

**Made with ❤️ by [Rafacuy](https://github.com/Rafacuy)**

[⬆ Back to Top](#-desklumina)

</div>
