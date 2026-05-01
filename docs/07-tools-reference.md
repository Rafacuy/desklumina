# 07 - Tools Reference

Complete documentation for all available tools in DeskLumina's automation system.

---

## Table of Contents

- [Overview](#overview)
- [Application Tool (app)](#application-tool-app)
- [File Tool (file)](#file-tool-file)
- [Media Tool (media)](#media-tool-media)
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

Tool calls are parsed from markdown code fences in the model output. The registered tools are: `app`, `terminal`, `file`, `media`, `music`, `clipboard`, `notify` (see `src/tools/registry.ts`).

## BREAKING CHANGES

- `app` rejects unknown aliases instead of executing them through `bash -c`.
- `file` rejects unknown actions instead of falling through to shell execution.
- `media` arguments are normalized and validated before execution. Canonical volume syntax is `volume <0-100 | +N | -N>`.

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
| `term`, `terminal` | Terminal | `alacritty` (Default) |
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
- File operations (`mkdir`, `rm`, `mv`, `cp`, `ls`) are executed via direct array-based spawning (`Bun.spawn`). This eliminates shell injection vulnerabilities by bypassing the shell entirely.
- Some operations trigger a Rofi confirmation when they involve critical system paths (see `src/tools/files.ts`).
- If the first token is not a supported operation, `file` now returns a validation error instead of executing shell commands. There is no fallback to arbitrary shell execution.
- Advanced search results are structured: DeskLumina stores matched files, selected file, preview data, actions performed, and summary counts.
- Preview returns file contents for readable text files and directory listings for folders; binary files return metadata without dumping raw bytes.
- Search history is stored under `~/.config/desklumina/file-search-history.json`.
- `fzf` selection is terminal-oriented. In Rofi mode, DeskLumina shows deterministic result lists and previews instead of spawning an interactive fuzzy picker.

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

### Argument Rules
- Natural-language requests like "volume up", "volume down", and "set volume to 30" are normalized internally.
- The model should emit canonical tool args only: `volume <0-100 | +N | -N>`.
- Invalid media actions fail fast with a validation error instead of being passed through to the shell.

---

## Music Tool (`music`)

Manage your music library, playlists, and playback through MPD via `mpc`. The music tool handles library operations (search, list, playlist loading), whereas the media tool handles playback controls (play, pause, volume).

**Path**: `src/tools/music.ts`  
**Dependencies**: `mpc` (Music Player Daemon client), optional `ncmpcpp` (for status display enhancement)

### Supported Actions:

| Action | Arguments | Description |
|--------|-----------|-------------|
| `search` | `<query>` | Search tracks by name, artist, album, etc. Returns up to 50 matches. |
| `play` | `<target>` | Play a specific track. Target can be a track number (queue index) or search query. If a query, searches and plays the first match. |
| `playlist` | `<name>` | Load and play a saved playlist by name. Clears current queue first. |
| `ls` or `list` | `music` or `playlists` | List all tracks in library or saved playlists. |
| `queue` | (none) | Display current queue and now-playing track. |
| `status` or `now` | (none) | Show current playback status. Uses `ncmpcpp --current-song` if available, falls back to `mpc current`. |
| `update` | (none) | Refresh MPD's music database, then list library. |

### Query Normalization

User queries are normalized by stripping common natural-language prefixes:
- Removed prefixes: `please`, `tolong`, `putar`, `play`, `search`, `find`, `cari`, `song`, `lagu`, `music`, `musik`
- Removed suffixes: `song`, `lagu`, `music`, `musik`

Examples:
- "play music foo" → `play foo`
- "search for song bar" → `search bar`

### Playback Behavior

**Search and Play**: When using `play <query>`:
1. Searches library for the query
2. If found, clears the current queue
3. Adds the first match to queue
4. Starts playback

If the target is a numeric index (e.g., `play 3`), it skips the search and plays that position in the current queue directly.

**Status Display**: The `status` action attempts to use `ncmpcpp --current-song` for enhanced display. If `ncmpcpp` is not installed, it falls back to `mpc current`. In both cases, it also appends the output of `mpc status` to show playback state (playing/paused/stopped) and time information.

### UI Behavior

Search results and playlists are returned as structured data in the tool result. The AI assistant formats and displays them as text. No interactive Rofi menu integration is currently implemented for music operations.

### Error Handling

- **Missing `mpc`**: Returns error code 127 if `mpc` is not installed (required for all operations).
- **Empty Search**: Returns success with status `empty` if no tracks match the query.
- **Track Not Found**: Returns a 404-style error when `play <query>` finds no results.
- **Playlist Load Failure**: Returns the stderr from `mpc load` if the playlist doesn't exist.

### Requirements

- **Required**: `mpc` (from `mpc` package in your distro)
- **Optional**: `ncmpcpp` (for enhanced status display; falls back to `mpc` if missing)
- **Optional**: `rofi` (for music selection UI integration; not required for tool execution)

### Example Tool Calls

```json
{"tool": "music", "args": "search pink floyd"}
{"tool": "music", "args": "play wish you were here"}
{"tool": "music", "args": "playlist my-favorites"}
{"tool": "music", "args": "ls playlists"}
{"tool": "music", "args": "queue"}
{"tool": "music", "args": "status"}
```

---

## Clipboard Tool (`clipboard`)

Manage your clipboard via `clipcatctl`.

**Path**: `src/tools/clipboard.ts`

### Supported Actions:
- `get`: `clipcatctl get`
- `list`: `clipcatctl list`
- `set <text>`: `clipcatctl insert` (piped from `echo`)
- `clear`: `clipcatctl clear`

### Limitations:
- Maximum content size: 1MB (1,048,576 bytes). Content exceeding this limit will be rejected.

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
