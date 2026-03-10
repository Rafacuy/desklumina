<div align="center">

# 🌟 DeskLumina

**AI-Powered Desktop Automation Agent for BSPWM**

*Control your desktop with natural language*

[![Bun](https://img.shields.io/badge/Runtime-Bun-f9f1e5?style=flat-square&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Lines of Code](https://sloc.xyz/github/Rafacuy/desklumina)]()

</div>

---

## ⚠️ Important Notice

> **This application is designed specifically for the [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) configuration.**
>
> Please ensure you have the dotfiles installed before using DeskLumina.

---

## 📖 Table of Contents

- [Features](#-features)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Usage](#-usage)
- [Tool System](#-tool-system)
- [Model Fallback System](#-model-fallback-system)
- [Configuration](#-configuration)
- [Security](#-security)
- [Development](#-development)
- [API Reference](#-api-reference)
- [Acknowledgments](#-acknowledgments)

---

## ✨ Features

| Category | Features |
|----------|----------|
| **🤖 AI Integration** | Natural language control, streaming responses via Groq API, automatic model fallback |
| **🖥️ Window Manager** | Full BSPWM integration - workspaces, windows, layouts, focus management |
| **🪟 Context Awareness** | Automatic detection of active window/application for context-aware commands |
| **🚀 Applications** | Launch apps with simple aliases, detached process support, custom command fallback |
| **📁 File Operations** | Create, move, copy, delete, search files and directories with safety checks |
| **🎵 Media Control** | MPD integration - play, pause, volume, playlists, search |
| **📋 Clipboard** | Clipcat clipboard management and history |
| **🔔 Notifications** | Dunst desktop notifications with urgency levels |
| **💬 Chat History** | Persistent conversations with auto-generated titles |
| **🔊 Text-to-Speech** | Edge TTS integration with Indonesian voices (Gadis/Ardi), speed control |
| **🎨 UI** | Beautiful Rofi-based graphical interface with theme support |
| **🔒 Security** | Dangerous command detection, confirmation prompts, timeout protection |

---

## 🏗️ Project Structure

```
src/
├── main.ts                          # Entry point with CLI argument handling
│
├── types/                           # TypeScript type definitions
│   ├── index.ts                     # Barrel export
│   ├── ai.ts                        # AIMessage, ModelConfig
│   ├── chat.ts                      # Chat, ChatMessage, ToolCall, ToolResult
│   ├── settings.ts                  # Settings, FeatureFlags, DEFAULT_SETTINGS
│   └── tool.ts                      # ToolHandler, ToolRegistry, ParsedToolCall
│
├── constants/                       # Application constants
│   ├── index.ts                     # Barrel export
│   ├── commands.ts                  # DANGEROUS_COMMAND_PATTERNS, COMMAND_TIMEOUT
│   └── models.ts                    # DEFAULT_FALLBACK_MODELS, GROQ_API_ENDPOINT
│
├── core/                            # Core business logic
│   ├── index.ts                     # Barrel export
│   ├── chat-manager.ts              # Chat persistence and history management
│   ├── context.ts                   # Conversation context tracking
│   ├── lumina.ts                    # AI agent orchestration with TTS support
│   ├── planner.ts                   # Tool call parsing and planning
│   └── settings-manager.ts          # Settings persistence and feature flags
│
├── ai/                              # AI integration
│   ├── index.ts                     # Barrel export
│   ├── groq.ts                      # Groq API streaming with fallback support
│   ├── prompts.ts                   # System prompt builder with environment context
│   ├── stream.ts                    # SSE response parser
│   └── tts.ts                       # Edge TTS text-to-speech with Indonesian voices
│
├── tools/                           # Tool implementations
│   ├── index.ts                     # Tool dispatcher barrel export
│   ├── registry.ts                  # Tool registry with registerTool()
│   ├── apps.ts                      # Application launcher with aliases
│   ├── bspwm.ts                     # BSPWM window manager control
│   ├── clipboard.ts                 # Clipcat clipboard management
│   ├── files.ts                     # File system operations
│   ├── media.ts                     # MPD music player control
│   ├── notify.ts                    # Dunst notification sender
│   ├── terminal.ts                  # Shell command execution with security
│   └── window-info.ts               # Active window detection and context
│
├── ui/                              # User interface components
│   ├── index.ts                     # Barrel export
│   ├── loader.ts                    # Loading animation component
│   ├── rofi.ts                      # Rofi launcher integration
│   ├── settings.ts                  # Settings menu UI
│   ├── tool-display.ts              # Tool call/result formatting
│   └── themes/                      # Rofi theme configurations
│       └── lumina.rasi              # Main Rofi theme
│
├── security/                        # Security & validation
│   ├── index.ts                     # Barrel export
│   ├── confirmation.ts              # Rofi confirmation dialogs
│   └── dangerous-commands.ts        # Command pattern analysis
│
├── utils/                           # Helper functions
│   ├── index.ts                     # Barrel export
│   ├── format.ts                    # Formatting utilities (formatFileSize, truncate)
│   └── path.ts                      # Path utilities (expandTilde, normalizePath)
│
├── config/                          # Configuration
│   ├── apps.json                    # Application alias mappings
│   └── env.ts                       # Environment variable validation
│
└── logger/                          # Logging system
    ├── index.ts                     # Centralized logger
    └── types.ts                     # Logger type exports
```

---

## 📦 Installation

### Prerequisites

| Requirement | Version | Description |
|-------------|---------|-------------|
| **Bun** | v1.3.9+ | JavaScript runtime |
| **BSPWM** | Latest | Tiling window manager |
| **Rofi** | Latest | Window switcher/launcher |
| **Dunst** | Latest | Notification daemon |
| **Clipcat** | Latest | Clipboard manager |
| **MPD + MPC** | Latest | Music player daemon and client |
| **SXHKD** | Latest | Simple X hotkey daemon |

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
   ```bash
   nano .env
   ```

4. **Verify installation:**
   ```bash
   bun run src/main.ts --version
   ```

---

## 🚀 Usage

### Interactive Mode (Rofi UI)

Launch the graphical interface:

```bash
bun start
```

### Terminal Chat Mode

Interactive terminal-based conversation with chat history:

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

Run a single command without interactive mode:

```bash
bun run src/main.ts --exec "open telegram"
```

### Version Check

```bash
bun run src/main.ts --version
```

**Output:**
```
Lumina v1.0.0
Model: openai/gpt-oss-120b
```

---

## 🔧 Tool System

DeskLumina uses **JSON-based tool calls** embedded in markdown code blocks for desktop automation.

### Tool Call Format

The AI responds with tool calls in this format:

```json
{"tool": "app", "args": "browser"}
```

Or multiple tools:

```json
[
  {"tool": "bspwm", "args": "focus_workspace 3"},
  {"tool": "app", "args": "browser"}
]
```

### Available Tools

| Tool | Description | Example |
|------|-------------|---------|
| `app` | Launch applications by alias | `{"tool": "app", "args": "telegram"}` |
| `terminal` | Execute shell commands | `{"tool": "terminal", "args": "ls -la"}` |
| `bspwm` | Window/workspace management | `{"tool": "bspwm", "args": "focus_workspace 2"}` |
| `file` | File operations | `{"tool": "file", "args": "list ~/Downloads"}` |
| `media` | Music player control | `{"tool": "media", "args": "toggle"}` |
| `clipboard` | Clipboard management | `{"tool": "clipboard", "args": "list"}` |
| `notify` | Desktop notifications | `{"tool": "notify", "args": "Title\|Body\|normal"}` |

---

### Application Aliases

<details>
<summary>📋 <strong>View all application aliases (click to expand)</strong></summary>

| Alias | Application | Command |
|-------|-------------|---------|
| `terminal`, `term` | Alacritty | `alacritty` |
| `kitty` | Kitty Terminal | `kitty` |
| `browser` | Default Browser | `xdg-open https://` |
| `chrome` | Google Chrome | `google-chrome-stable` |
| `files`, `thunar` | Thunar File Manager | `thunar` |
| `yazi` | Yazi TUI File Manager | `alacritty -e yazi` |
| `editor`, `geany` | Geany Text Editor | `geany` |
| `neovim`, `nvim` | Neovim | `alacritty -e nvim` |
| `music`, `ncmpcpp` | NCMPCPP Music Client | `alacritty -e ncmpcpp` |
| `telegram`, `tg` | Telegram Desktop | `telegram-desktop` |
| `whatsapp`, `wa` | WhatsApp Web | `xdg-open https://web.whatsapp.com` |
| `youtube`, `yt` | YouTube | `xdg-open https://youtube.com` |
| `github` | GitHub | `xdg-open https://github.com` |
| `spotify` | Spotify Web | `xdg-open https://open.spotify.com` |
| `pavucontrol`, `volume` | PulseAudio Volume Control | `pavucontrol` |
| `bluetooth` | Bluetooth Manager | `blueman-manager` |
| `btop` | BTop System Monitor | `alacritty -e btop` |
| `htop` | HTop System Monitor | `alacritty -e htop` |

</details>

---

### BSPWM Actions

<details>
<summary>🖥️ <strong>View BSPWM commands (click to expand)</strong></summary>

| Action | Description | Command |
|--------|-------------|---------|
| `focus_workspace <n>` | Switch to workspace n | `bspc desktop -f ^<n>` |
| `move_window_to <n>` | Move window to workspace n | `bspc node -d ^<n>` |
| `close_focused` | Close focused window | `bspc node -c` |
| `kill_focused` | Kill focused window | `bspc node -k` |
| `toggle_fullscreen` | Toggle fullscreen mode | `bspc node -t fullscreen` |
| `toggle_floating` | Toggle floating mode | `bspc node -t floating` |
| `toggle_monocle` | Toggle monocle layout | `bspc desktop -l monocle` |
| `focus_north` | Focus window above | `bspc node -f north` |
| `focus_south` | Focus window below | `bspc node -f south` |
| `focus_east` | Focus window right | `bspc node -f east` |
| `focus_west` | Focus window left | `bspc node -f west` |
| `rotate_desktop` | Rotate desktop 90° | `bspc node @/ -R 90` |
| `list_windows` | List windows in workspace | `bspc query -N -d` |
| `get_focused_window` | Get focused window ID | `bspc query -N -n focused` |
| `reload_sxhkd` | Reload keybindings | `pkill -USR1 sxhkd` |
| `reload_bspwm` | Reload window manager | `bspc wm -r` |
| `list_workspaces` | List all workspaces | `bspc query -D` |

</details>

---

### File Operations

<details>
<summary>📁 <strong>View file operations (click to expand)</strong></summary>

| Operation | Syntax | Example |
|-----------|--------|---------|
| `create_dir` | Create directory | `{"tool": "file", "args": "create_dir ~/Projects"}` |
| `delete` | Delete file/folder | `{"tool": "file", "args": "delete ~/temp.txt"}` |
| `move` | Move/rename file | `{"tool": "file", "args": "move file.txt newfile.txt"}` |
| `copy` | Copy file/folder | `{"tool": "file", "args": "copy file.txt backup/"}` |
| `list` | List directory | `{"tool": "file", "args": "list ~/Downloads"}` |
| `read` | Read file content | `{"tool": "file", "args": "read config.json"}` |
| `write` | Write to file | `{"tool": "file", "args": "write file.txt content"}` |
| `find` | Find files by pattern | `{"tool": "file", "args": "find ~/docs *.pdf"}` |

**Safety Features:**
- ⚠️ Dangerous path detection (/, /bin, /etc, /sys, etc.)
- ⚠️ Confirmation prompts for system-critical operations
- ⚠️ Tilde (~) path expansion

</details>

---

### Media Control

<details>
<summary>🎵 <strong>View media commands (click to expand)</strong></summary>

| Action | Description | Command |
|--------|-------------|---------|
| `play` | Start playback | `mpc play` |
| `pause` | Pause playback | `mpc pause` |
| `toggle` | Toggle play/pause | `mpc toggle` |
| `next` | Next track | `mpc next` |
| `prev` | Previous track | `mpc prev` |
| `stop` | Stop playback | `mpc stop` |
| `volume <level>` | Set volume (-100 to 100) | `mpc volume 50` |
| `current` | Show current track | `mpc current` |
| `queue` | Show playlist | `mpc playlist` |
| `search <query>` | Search music library | `mpc search any "artist"` |

</details>

---

### Clipboard Operations

<details>
<summary>📋 <strong>View clipboard commands (click to expand)</strong></summary>

| Action | Description | Command |
|--------|-------------|---------|
| `get` | Get clipboard content | `clipcatctl get` |
| `list` | List clipboard history | `clipcatctl list` |
| `set <text>` | Set clipboard content | `clipcatctl insert` |
| `clear` | Clear clipboard history | `clipcatctl clear` |

</details>

---

### Notifications

<details>
<summary>🔔 <strong>View notification format (click to expand)</strong></summary>

**Syntax:** `title|body|urgency`

| Urgency Level | Description |
|---------------|-------------|
| `low` | Low priority notifications |
| `normal` | Standard notifications |
| `critical` | Urgent/critical alerts |

**Example:**
```json
{"tool": "notify", "args": "Task Complete\|Your file has been processed\|normal"}
```

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
│ Fallback Model 3│
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
FALLBACK_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,openai/gpt-oss-20b
```

### Error Handling

| Error Type | HTTP Code | Behavior |
|------------|-----------|----------|
| Model not found | 404 | Automatically tries next fallback |
| Model unavailable | 400 | Automatically tries next fallback |
| Rate limit | 429 | Tries next fallback |
| Network error | - | Rethrown immediately |
| All models failed | - | Returns detailed error with attempted models |

---

## ⚙️ Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `GROQ_API_KEY` | string | *required* | Groq API authentication key |
| `MODEL_NAME` | string | *required* | Primary AI model identifier |
| `FALLBACK_MODELS` | string | *auto* | Comma-separated fallback models |

### Constants

Key constants are defined in `src/constants/`:

| Constant | Value | Description |
|----------|-------|-------------|
| `COMMAND_TIMEOUT` | `30000` | Command execution timeout (30s) |
| `MODEL_TEMPERATURE` | `0.7` | AI response temperature |
| `MAX_TOKENS` | `2048` | Maximum response tokens |
| `GROQ_API_ENDPOINT` | `https://api.groq.com/...` | Groq API endpoint |

### Theme Configuration

Lumina reads the active theme from `~/.config/bspwm/.rice` and applies corresponding Rofi themes from `src/ui/themes/`.

### Chat Storage

Conversations are stored as JSON files in `~/.config/bspwm/agent/chats/` with:

- Auto-generated titles based on first message
- Full conversation history with timestamps
- Tool call and result tracking
- Automatic cleanup and sorting

### TTS Configuration

Text-to-Speech is configured in `settings.json` with the following options:

| Option | Description | Default |
|--------|-------------|---------|
| `voiceId` | Voice to use for speech | `id-ID-GadisNeural` |
| `speed` | Speech speed multiplier (0.5-2.0) | `1.0` |

**Available Voices:**
- `id-ID-GadisNeural` - Female voice (Gadis)
- `id-ID-ArdiNeural` - Male voice (Ardi)

**TTS Speed Options:**
- `0.5x` - Slow
- `0.75x` - Slightly slow
- `1.0x` - Normal (default)
- `1.25x` - Slightly fast
- `1.5x` - Fast
- `2.0x` - Very fast

> **Note:** TTS can be toggled on/off via the settings menu (`rofiSettings`).

---

## 🔒 Security

### Safety Measures

| Feature | Description |
|---------|-------------|
| **Dangerous Command Detection** | Pattern-based analysis of shell commands |
| **Confirmation Prompts** | Rofi dialogs for critical operations |
| **Path Protection** | Blocks operations on system directories |
| **Timeout Protection** | Commands timeout after 30 seconds |
| **Environment Isolation** | API keys stored in `.env` only |
| **Input Sanitization** | All inputs validated before execution |

### Dangerous Command Patterns

**Critical Severity (requires confirmation):**
- `rm -rf` - Recursive deletion
- `sudo` - Privilege escalation
- `shutdown/reboot/poweroff` - System power control
- `mkfs/fdisk/parted` - Filesystem operations
- `dd` - Low-level disk operations
- `curl \| sh` - Remote code execution
- `iptables -F` - Firewall flush

**High Severity (requires confirmation):**
- `rm` - File deletion
- `kill/pkill/killall` - Process termination
- `systemctl stop/restart` - Service control
- `chmod/chown` - Permission changes
- `mount/umount` - Mount operations

**Medium Severity (logged):**
- `cp` - File copying
- `wget/curl -o` - Downloads
- `pip/npm/apt` - Package management

### Protected Paths

Operations on these paths require explicit confirmation:

```
/ /bin /boot /dev /etc /lib /root /sys /usr /var
```

---

## 💻 Development

### Scripts

```bash
# Type checking
bun run lint

# Development mode (watch + terminal chat)
bun run dev

# Production start
bun start

# Run with custom exec
bun run src/main.ts --exec "your command"
```

### Code Conventions

- All tool handlers return `Promise<string>`
- Command timeout: **30 seconds**
- Detached processes for app launching
- Centralized logging via `logger` module
- Strict TypeScript with `noUncheckedIndexedAccess`
- Skip library checks for faster compilation



### Adding New Tools

1. **Create tool handler** in `src/tools/`:
   ```typescript
   // src/tools/custom.ts
   import { execute } from "./terminal";
   
   export async function custom(action: string): Promise<string> {
     // Your implementation
     return "Result";
   }
   ```

2. **Export from tools/index.ts**:
   ```typescript
   export { custom } from "./custom";
   ```

3. **Register in registry.ts** (optional):
   ```typescript
   import { registerTool } from "./registry";
   
   registerTool("custom", custom);
   ```

---

## 📚 API Reference

### Core Classes

#### `Lumina`
Main AI agent orchestrator.

```typescript
import { Lumina } from "./core";

const lumina = new Lumina(chatManager);
await lumina.chat("open telegram", (chunk) => {
  process.stdout.write(chunk);
});
```

#### `ChatManager`
Manages chat persistence and history.

```typescript
import { ChatManager } from "./core";

const chatManager = new ChatManager();
chatManager.createChat("Initial message");
chatManager.addMessage("Hello!", "user");
const chats = chatManager.getAllChats();
```

### Utility Functions

#### Path Utilities (`src/utils/path.ts`)

```typescript
import { expandTilde, normalizePath } from "./utils";

expandTilde("~/Documents");  // "/home/user/Documents"
normalizePath("path\\to\\file");  // "path/to/file"
```

#### Format Utilities (`src/utils/format.ts`)

```typescript
import { formatFileSize, truncate, formatRelativeTime } from "./utils";

formatFileSize(1536000);  // "1.5 MB"
truncate("Long text...", 10);  // "Long te..."
formatRelativeTime(new Date());  // "baru saja"
```

### Security Functions

```typescript
import { isDangerousCommand, analyzeCommand } from "./security";

isDangerousCommand("rm -rf /");  // true
analyzeCommand("ls -la");
// { isDangerous: false, highestSeverity: "safe", summary: "Perintah aman" }
```

### Tool Registry

```typescript
import { registerTool, getRegisteredTools } from "./tools";

// Register custom tool
registerTool("mytool", async (arg) => {
  return `Custom result: ${arg}`;
});

// List all tools
const tools = getRegisteredTools();
```

---

## 🙏 Acknowledgments

Built with love using:

- [**Bun**](https://bun.sh) - Fast JavaScript runtime
- [**Groq API**](https://groq.com) - Ultra-fast LLM inference
- [**BSPWM**](https://github.com/baskerville/bspwm) - Tiling window manager
- [**Rofi**](https://github.com/davatorium/rofi) - Window switcher/launcher
- [**Dunst**](https://github.com/dunst-project/dunst) - Notification daemon
- [**Clipcat**](https://github.com/xrelkd/clipcat) - Clipboard manager
- [**MPD**](https://www.musicpd.org) - Music player daemon

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ by [Rafacuy](https://github.com/Rafacuy)**

[⬆ Back to Top](#-desklumina)

</div>
