# 07 - Tools Reference

Complete documentation for all available tools in DeskLumina's automation system.

---

## Table of Contents

- [Overview](#overview)
- [Application Tool (app)](#application-tool-app)
- [File Tool (file)](#file-tool-file)
- [Music Tool (music)](#music-tool-music)
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

Tool calls are parsed from markdown code fences in the model output. The canonical tools are: `app`, `terminal`, `file`, `music`, `clipboard`, and `notify`.

`media` is accepted as a legacy alias for `music` for backward compatibility. New prompts, examples, and integrations should use `music`.

---

## Application Tool (`app`)

Launch an application by alias. Aliases are defined in `src/config/apps.json`. If an alias is not found, the tool returns an explicit error and the assistant must use the `terminal` tool for shell commands.

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
| `term`, `terminal` | Terminal | `alacritty` |
| `neovim`, `nvim` | Text Editor | `alacritty -e nvim` |
| `files`, `thunar` | File Manager | `thunar` |
| `yazi` | TUI File Manager | `alacritty -e yazi` |
| `music` | Music Player | `alacritty -e ncmpcpp` |
| `btop`, `htop` | System Monitor | `alacritty -e btop` |

---

## File Tool (`file`)

Perform file and directory operations safely, including indexed file discovery and preview.

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
| `preview` | `<path>` | `preview ~/.config/bspwm/bspwmrc` |
| `history` | `[limit]` | `history 5` |
| `repeat_last` | none | `repeat_last` |
| `search_name` | `<query> [filters]` | `search_name bspwm base=~/.config type=file preview=true` |
| `search_path` | `<query> [filters]` | `search_path .config/bspwm type=file` |
| `search_pattern` | `<regex> [filters]` | `search_pattern "bspwm(rc)?$" base=~/.config` |

### Advanced Search Filters

Advanced search operations use `locate` as the primary indexed backend and support these canonical key-value filters:

| Filter | Values | Description |
|--------|--------|-------------|
| `base` | `<path>` | Restrict results to a base directory |
| `type` | `file`, `directory`, `any` | Restrict by entry type |
| `ext` | `md,txt,json` | Restrict by extension list |
| `hidden` | `true`, `false` | Include only hidden or non-hidden entries |
| `limit` | `1-200` | Cap returned matches |
| `select` | `true`, `false` | Open terminal-side `fzf` selection when a TTY is available |
| `preview` | `true`, `false` | Attach file or directory preview data |

### Notes

- Paths starting with `~` are expanded to `$HOME`.
- File operations like `mkdir`, `rm`, `mv`, `cp`, and `ls` are executed via direct array-based spawning. This eliminates shell injection vulnerabilities.
- Some operations trigger a Rofi confirmation when they involve critical system paths.
- If the first token is not a supported operation, `file` returns a validation error.
- Advanced search results are structured: DeskLumina stores matched files, selected file, preview data, actions performed, and summary counts.
- Preview returns file contents for readable text files and directory listings for folders; binary files return metadata without dumping raw bytes.
- Search history is stored under `~/.config/desklumina/file-search-history.json`.
- `fzf` selection is terminal-oriented. In Rofi mode, DeskLumina shows deterministic result lists and previews instead of spawning an interactive fuzzy picker.

---

## Music Tool (`music`)

A generalized media transport controller that provides a media-agnostic interface for playback and volume control. It prioritizes MPC/MPD for local music but intelligently falls back to `playerctl` (MPRIS) for applications like Spotify, VLC, and browsers.

**Path**: `src/tools/music.ts`  
**Backends**: `mpc` (primary), `playerctl` (fallback).

### Supported Actions:

| Action | Description |
|--------|-------------|
| `play` | Start or resume playback. |
| `resume` | Resume playback (alias for `play`). |
| `pause` | Pause playback. |
| `stop` | Stop playback. |
| `next` | Skip to the next track. |
| `prev` | Skip to the previous track. |
| `volume up` | Increase volume by 5% (alias: `vol up`). |
| `volume down` | Decrease volume by 5% (alias: `vol down`). |

### Fallback Behavior

1. **MPC First**: The tool attempts to execute the action via `mpc`. If `mpc` is missing, disconnected, or fails (e.g., empty playlist), it moves to the next backend.
2. **Playerctl Fallback**: If MPC fails, it attempts the action via `playerctl`. This covers Spotify, Chromium, Firefox, VLC, and any other MPRIS-compatible player.
3. **Graceful Failure**: If no backends are available or all fail, a structured error is returned without crashing.

---

## Clipboard Tool (`clipboard`)

Manage your clipboard via `clipcatctl`.

**Path**: `src/tools/clipboard.ts`

### Supported Actions:
- `get`: `clipcatctl get`
- `list`: `clipcatctl list`
- `set <text>`: `clipcatctl insert`
- `clear`: `clipcatctl clear`

### Limitations:
- Maximum content size: 1MB. Content exceeding this limit will be rejected.

---

## Terminal Tool (`terminal`)

Execute a shell command via `bash -c <command>`. Commands are analyzed for dangerous patterns; if matched, DeskLumina shows a Rofi confirmation prompt before execution.

**Path**: `src/tools/terminal.ts`

### Usage:
- `{"tool": "terminal", "args": "ls -la"}`
- `{"tool": "terminal", "args": "free -m"}`

### Security:
- **Command analysis**: `src/security/dangerous-commands.ts`
- **Confirmation UI**: `src/security/confirmation.ts`
- **Timeout**: 30 seconds.

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

- 🛡️ **[Security Guide](09-security.md)**: Learn more about safe execution.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Optimize tool performance.
- 🛠️ **[Development Guide](10-development.md)**: Learn how to create your own tools.

---

[← Usage Guide](06-usage-guide.md) | [Security →](09-security.md)
