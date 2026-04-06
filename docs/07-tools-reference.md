# 07 - Tools Reference

Complete documentation for all available tools in DeskLumina's automation system.

---

## Table of Contents

- [Overview](#overview)
- [Application Tool (app)](#application-tool-app)
- [File Tool (file)](#file-tool-file)
- [Media Tool (media)](#media-tool-media)
- [Clipboard Tool (clipboard)](#clipboard-tool-clipboard)
- [Terminal Tool (terminal)](#terminal-tool-terminal)
- [Notification Tool (notify)](#notification-tool-notify)

---

## Overview

DeskLumina uses a modular tool-based architecture. The AI agent generates structured JSON tool calls, which are then executed by specialized handlers.

### Tool Call Format

```json
{"tool": "tool_name", "args": "arguments"}
```

Tool calls are parsed from markdown ```json code fences in the model output. The only registered tools are: `app`, `terminal`, `file`, `media`, `clipboard`, `notify` (see `src/tools/registry.ts`).

---

## Application Tool (`app`)

Launch an application by alias. Aliases are defined in `src/config/apps.json`. If an alias is not found, the tool treats the input as a shell command and executes it via `bash -c` (with dangerous-command confirmation when matched by the analyzer).

**Path**: `src/tools/apps.ts`  
**Aliases Configuration**: `src/config/apps.json`

### Usage Examples:
- "open browser" -> `{"tool": "app", "args": "browser"}`
- "start telegram" -> `{"tool": "app", "args": "telegram"}`

### Default Aliases (Partial List):

| Alias | Description | System Command |
|-------|-------------|----------------|
| `browser` | Web Browser | `xdg-open https://` |
| `telegram`, `tg` | Telegram | `telegram-desktop` |
| `term`, `terminal` | Terminal | `alacritty` (Default) |
| `neovim`, `nvim` | Text Editor | `alacritty -e nvim` |
| `files`, `thunar` | File Manager | `thunar` |
| `yazi` | TUI File Manager | `alacritty -e yazi` |
| `music` | Music Player | `alacritty -e ncmpcpp` |
| `btop`, `htop` | System Monitor | `alacritty -e btop` |

---

## File Tool (`file`)

Perform file and directory operations safely.

**Path**: `src/tools/files.ts`

### Supported Operations:

| Operation | Arguments | Example |
|-----------|-----------|---------|
| `list` | `<path>` | `list ~/Documents` |
| `create_dir`| `<path>` | `create_dir ~/Projects/NewApp` |
| `move` | `<src> <dest>` | `move file.txt backup/` |
| `copy` | `<src> <dest>` | `copy notes.md notes_bkp.md` |
| `delete` | `<path>` | `delete temporary.log` |
| `read` | `<path>` | `read config.json` |
| `write` | `<path> <text>`| `write log.txt "Entry updated"` |
| `find` | `<dir> <name>` | `find ~/Downloads report.pdf` |

### Notes

- Paths starting with `~` are expanded to `$HOME`.
- Some operations trigger a Rofi confirmation when they involve critical system paths (see `src/tools/files.ts`).
- If the first token is not a supported operation, `file` falls back to executing the full string as a shell command (via `terminal.execute()`).

---

## Media Tool (`media`)

Control MPD via `mpc` (the tool shells out to `mpc ...`).

**Path**: `src/tools/media.ts`

### Supported Actions:
- `play`, `pause`, `toggle`, `stop`
- `next`, `prev`
- `volume <level>` (e.g., `volume 50`, `volume +10`, `volume -10`)
- `current` (Shows currently playing track info)
- `search <query>` (Search within your music library)
- `queue` (Print playlist via `mpc playlist`)

---

## Clipboard Tool (`clipboard`)

Manage your clipboard via `clipcatctl`.

**Path**: `src/tools/clipboard.ts`

### Supported Actions:
- `get`: `clipcatctl get`
- `list`: `clipcatctl list`
- `set <text>`: `clipcatctl insert` (piped from `echo`)
- `clear`: `clipcatctl clear`

---

## Terminal Tool (`terminal`)

Execute a shell command via `bash -c <command>`. Commands are analyzed for dangerous patterns; when matched, DeskLumina shows a Rofi confirmation prompt before execution.

**Path**: `src/tools/terminal.ts`

### Usage:
- `{"tool": "terminal", "args": "ls -la"}`
- `{"tool": "terminal", "args": "free -m"}`

### Security:
- **Command analysis**: `src/security/dangerous-commands.ts`
- **Confirmation UI**: `src/security/confirmation.ts`
- **Timeout**: 30 seconds (`COMMAND_TIMEOUT = 30000` in `src/constants/commands.ts`)

---

## Notification Tool (`notify`)

Send desktop notifications to the user.

**Path**: `src/tools/notify.ts`

### Format:
`<title>|<message>|<urgency>`

### Urgency Levels:
- `low`
- `normal`
- `critical`

### Example:
`"Task Complete|Project successfully built!|normal"`

---

## Next Steps

- 🛡️ **[Security Guide](09-security.md)** — Learn more about safe execution.
- 🤖 **[Daemon Mode](11-daemon-mode.md)** — Optimize tool performance.
- 🛠️ **[Development Guide](10-development.md)** — Learn how to create your own tools.

---

[← Usage Guide](06-usage-guide.md) | [Security →](09-security.md)
