# DeskLumina (BETA TESTING)

AI-powered desktop automation agent designed for BSPWM window manager environments. Lumina acts as an intelligent assistant that can control your desktop, manage applications, execute commands, and automate daily tasks through natural language interaction.

| WARNING:
| THIS BSPWM APP ONLY SUPPORTED ON THE [https://github.com/github.com/gh0stzk/dotfiles](gh0stzk) DOTFILES ONLY.
| MAKE SURE TO INSTALL THE DOTFILES FIRST.

## Features

- **Natural Language Control** - Interact with your desktop using conversational commands
- **BSPWM Integration** - Full control over workspaces, windows, and window manager settings
- **Application La:uncher** - Open and manage applications with simple aliases
- **File Operations** - Create, move, copy, delete, and search files
- **Media Control** - Control MPD music player with play, pause, volume, and playlist management
- **Clipboard Management** - Access and manipulate clipboard history via clipcat
- **Desktop Notifications** - Send notifications through dunst
- **Terminal Execution** - Run shell commands with safety timeouts
- **Chat History** - Persistent conversation storage with context awareness
- **Rofi UI** - Beautiful graphical interface using rofi launcher
- **Streaming Responses** - Real-time AI response streaming via Groq API

## Architecture

```
src/
├── main.ts              # Entry point with CLI argument handling
├── agent/
│   ├── lumina.ts        # Core AI agent orchestration
│   ├── chat-manager.ts  # Chat persistence and history management
│   ├── context.ts       # Conversation context tracking
│   └── planner.ts       # Tool call parsing and planning
├── ai/
│   ├── groq.ts          # Groq API streaming integration
│   ├── prompts.ts       # System prompt builder with environment context
│   └── stream.ts        # SSE response parser
├── tools/
│   ├── index.ts         # Tool dispatcher registry
│   ├── terminal.ts      # Shell command execution
│   ├── apps.ts          # Application launcher with aliases
│   ├── bspwm.ts         # BSPWM window manager control
│   ├── files.ts         # File system operations
│   ├── media.ts         # MPD music player control
│   ├── clipboard.ts     # Clipcat clipboard management
│   └── notify.ts        # Dunst notification sender
├── ui/
│   ├── rofi.ts          # Rofi launcher integration
│   ├── loader.ts        # Loading animation component
│   └── themes/          # Rofi theme configurations
├── config/
│   ├── env.ts           # Environment variable validation
│   └── apps.json        # Application alias mappings
└── logger/
    └── index.ts         # Centralized logging system
```

## Installation

### Prerequisites

- **Bun** runtime (v1.3.9 or later)
- **BSPWM** window manager
- **Rofi** launcher with custom theme support
- **Dunst** notification daemon
- **Clipcat** clipboard manager
- **MPD** + **MPC** for music control
- **SXHKD** keybinding daemon

### Setup

1. Clone the repository and install dependencies:

```bash
bun install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

3. Edit `.env` and add your Groq API key:

```
GROQ_API_KEY=your_groq_api_key_here
MODEL_NAME=openai/gpt-oss-120b
```

## Usage

### Interactive Mode (Default)

Launches the Rofi-based graphical interface:

```bash
bun start
```

### Terminal Chat Mode

Interactive terminal-based conversation with chat management:

```bash
bun run dev
```

**Commands available in chat mode:**
- `exit` - Close the application
- `new` - Start a new chat session
- `list` - Display all saved chats
- `load <number>` - Load a specific chat by number

### Direct Execution

Run a single command and get the response:

```bash
bun run src/main.ts --exec "open telegram"
```

### Version Check

```bash
bun run src/main.ts --version
```

## Tool System

Lumina uses XML-style tool calls for desktop automation:

| Tool | Syntax | Description |
|------|--------|-------------|
| `app` | `<tool:app>alias</tool:app>` | Launch applications by alias |
| `terminal` | `<tool:terminal>command</tool:terminal>` | Execute shell commands |
| `bspwm` | `<tool:bspwm>action</tool:bspwm>` | Control window manager |
| `file` | `<tool:file>operation</tool:file>` | File system operations |
| `media` | `<tool:media>action</tool:media>` | Music player control |
| `clipboard` | `<tool:clipboard>action</tool:clipboard>` | Clipboard management |
| `notify` | `<tool:notify>title|body|urgency</tool:notify>` | Send notifications |

### Application Aliases

Pre-configured application shortcuts in `src/config/apps.json`:

- `terminal`, `term` - Alacritty terminal
- `browser` - Default web browser
- `files`, `thunar` - Thunar file manager
- `yazi` - Terminal file manager
- `editor`, `geany` - Geany text editor
- `neovim`, `nvim` - Neovim in terminal
- `music`, `ncmpcpp` - NCMPCPP music client
- `telegram`, `tg` - Telegram Desktop
- `whatsapp`, `wa` - WhatsApp Web
- `youtube`, `yt` - YouTube in browser
- `spotify` - Spotify Web
- `btop`, `htop` - System monitors

### BSPWM Actions

Supported window manager commands:

- `focus_workspace <n>` - Switch to workspace n
- `move_window_to <n>` - Move window to workspace n
- `close_focused` - Close focused window
- `toggle_fullscreen` - Toggle fullscreen mode
- `toggle_floating` - Toggle floating mode
- `focus_north/south/east/west` - Focus adjacent windows
- `rotate_desktop` - Rotate desktop layout
- `list_workspaces` - List all workspaces
- `reload_sxhkd` - Reload keybindings
- `reload_bspwm` - Reload window manager

### File Operations

Syntax: `<tool:file>command args</tool:file>`

- `create_dir <path>` - Create directory
- `delete <path>` - Delete file or directory
- `move <src> <dest>` - Move files
- `copy <src> <dest>` - Copy files
- `list <path>` - List directory contents
- `read <path>` - Read file content
- `write <path> <content>` - Write to file
- `find <path> <pattern>` - Search for files

### Media Control

- `play` - Start playback
- `pause` - Pause playback
- `toggle` - Toggle play/pause
- `next` - Next track
- `prev` - Previous track
- `stop` - Stop playback
- `volume <level>` - Set volume level
- `current` - Show current track
- `queue` - Show playlist
- `search <query>` - Search music library

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Groq API authentication key | Yes |
| `MODEL_NAME` | AI model identifier | Yes |

### Theme Configuration

Lumina reads the active theme from `~/.config/bspwm/.rice` and applies corresponding Rofi themes from `src/ui/themes/`.

### Chat Storage

Conversations are stored as JSON files in `chats/` with automatic title generation based on the first message.

## Development

### TypeScript Checking

```bash
bun run lint
```

### Project Structure Conventions

- All tool handlers return Promise<string>
- Commands timeout after 30 seconds
- Detached processes for application launching
- Centralized logging via logger module
- Strict TypeScript configuration with noUncheckedIndexedAccess

## Security Notes

- Destructive operations (rm -rf, kill) require explicit confirmation
- Path expansion prevents accidental root directory operations
- Command execution includes timeout protection
- API keys stored in environment variables only

## Acknowledgments

Built with Bun, Groq API, BSPWM, and Rofi for seamless Linux desktop automation. (Make sure you install it)
