# 07 - Tools Reference

Complete documentation for all available tools in DeskLumina's automation system.

---

## Overview

DeskLumina uses a tool-based architecture for desktop automation. The AI generates tool calls in JSON format, which are then executed to perform actions on your system.

### Tool Call Format

```json
{"tool": "tool_name", "args": "arguments"}
```

### Multiple Tool Calls

```json
[
  {"tool": "app", "args": "telegram"},
  {"tool": "bspwm", "args": "focus_workspace 3"}
]
```

---

## Available Tools

| Tool | Handler | Description |
|------|---------|-------------|
| `app` | `src/tools/apps.ts` | Launch applications |
| `terminal` | `src/tools/terminal.ts` | Execute shell commands |
| `bspwm` | `src/tools/bspwm.ts` | Window/workspace management |
| `file` | `src/tools/files.ts` | File operations |
| `media` | `src/tools/media.ts` | Music player control |
| `clipboard` | `src/tools/clipboard.ts` | Clipboard management |
| `notify` | `src/tools/notify.ts` | Desktop notifications |

---

## Application Tool

Launch applications by alias or command name.

### Usage

```json
{"tool": "app", "args": "alias"}
```

### Default Aliases

#### Terminal Emulators

| Alias | Application | Command |
|-------|-------------|---------|
| `terminal`, `term` | Alacritty | `alacritty` |
| `kitty` | Kitty Terminal | `kitty` |

#### Browsers

| Alias | Application | Command |
|-------|-------------|---------|
| `browser` | Default Browser | `xdg-open https://` |
| `chrome` | Google Chrome | `google-chrome-stable` |

#### File Managers

| Alias | Application | Command |
|-------|-------------|---------|
| `files`, `thunar` | Thunar | `thunar` |
| `yazi` | Yazi TUI | `alacritty -e yazi` |

#### Editors

| Alias | Application | Command |
|-------|-------------|---------|
| `editor`, `geany` | Geany | `geany` |
| `neovim`, `nvim` | Neovim | `alacritty -e nvim` |

#### Communication

| Alias | Application | Command |
|-------|-------------|---------|
| `telegram`, `tg` | Telegram | `telegram-desktop` |
| `whatsapp`, `wa` | WhatsApp Web | `xdg-open https://web.whatsapp.com` |

#### Web Services

| Alias | Application | Command |
|-------|-------------|---------|
| `youtube`, `yt` | YouTube | `xdg-open https://youtube.com` |
| `github` | GitHub | `xdg-open https://github.com` |
| `spotify` | Spotify Web | `xdg-open https://open.spotify.com` |

#### System Tools

| Alias | Application | Command |
|-------|-------------|---------|
| `music`, `ncmpcpp` | NCMPCPP | `alacritty -e ncmpcpp` |
| `pavucontrol`, `volume` | PulseAudio Control | `pavucontrol` |
| `bluetooth` | Bluetooth Manager | `blueman-manager` |
| `btop` | BTop Monitor | `alacritty -e btop` |
| `htop` | HTop Monitor | `alacritty -e htop` |

### Examples

```json
{"tool": "app", "args": "telegram"}
{"tool": "app", "args": "browser"}
{"tool": "app", "args": "nvim"}
```

---

## BSPWM Tool

Control window management and workspaces.

### Workspace Actions

| Action | Description |
|--------|-------------|
| `focus_workspace <n>` | Switch to workspace n |
| `move_window_to <n>` | Move active window to workspace n |
| `list_workspaces` | List all workspaces |

### Window Actions

| Action | Description |
|--------|-------------|
| `close_focused` | Close focused window |
| `kill_focused` | Kill focused window |
| `toggle_fullscreen` | Toggle fullscreen mode |
| `toggle_floating` | Toggle floating mode |
| `toggle_monocle` | Toggle monocle layout |
| `get_focused_window` | Get focused window ID |
| `list_windows` | List all windows |

### Focus Navigation

| Action | Description |
|--------|-------------|
| `focus_north` | Focus window above |
| `focus_south` | Focus window below |
| `focus_east` | Focus window right |
| `focus_west` | Focus window left |

### Desktop Actions

| Action | Description |
|--------|-------------|
| `rotate_desktop` | Rotate tree 90° |
| `reload_sxhkd` | Reload keybindings |
| `reload_bspwm` | Reload window manager |

### Special Actions

#### `wait_and_move <class> <workspace>`

Wait for a window to appear and move it to a workspace.

```json
{"tool": "bspwm", "args": "wait_and_move firefox 2"}
```

Behavior:
- Waits up to 5 seconds for window with class `<class>`
- Moves window to workspace `<workspace>`
- Returns success or timeout message

### Examples

```json
{"tool": "bspwm", "args": "focus_workspace 3"}
{"tool": "bspwm", "args": "move_window_to 2"}
{"tool": "bspwm", "args": "toggle_fullscreen"}
{"tool": "bspwm", "args": "wait_and_move Telegram 3"}
```

---

## File Tool

Perform file system operations with safety checks.

### Operations

#### `create_dir <path>`

Create a directory.

```json
{"tool": "file", "args": "create_dir ~/Projects/NewProject"}
```

Returns: `✓ Folder "/home/user/Projects/NewProject" dibuat`

---

#### `delete <path>`

Delete a file or folder.

```json
{"tool": "file", "args": "delete ~/temp.txt"}
```

Safety:
- Blocks deletion of protected paths
- Requires confirmation for dangerous paths

Returns: `✓ "/home/user/temp.txt" dihapus`

---

#### `move <src> <dest>`

Move or rename a file.

```json
{"tool": "file", "args": "move file.txt newfile.txt"}
```

Returns: `✓ Dipindah ke "newfile.txt"`

---

#### `copy <src> <dest>`

Copy a file or folder.

```json
{"tool": "file", "args": "copy document.txt ~/backup/"}
```

Returns: `✓ Disalin ke "/home/user/backup/"`

---

#### `list <path>`

List directory contents.

```json
{"tool": "file", "args": "list ~/Downloads"}
```

Returns: Directory listing (like `ls -la`)

---

#### `read <path>`

Read file content.

```json
{"tool": "file", "args": "read config.json"}
```

Returns: File contents

---

#### `write <path> <content>`

Write content to a file.

```json
{"tool": "file", "args": "write notes.txt Hello World"}
```

Returns: `✓ File "notes.txt" ditulis`

---

#### `find <path> <pattern>`

Find files by name pattern.

```json
{"tool": "file", "args": "find ~/Documents *.pdf"}
```

Returns: Matching file paths

### Protected Paths

Operations on these paths require confirmation:

```
/, /bin, /boot, /dev, /etc, /lib, /root, /sys, /usr, /var
```

### Path Handling

Tilde expansion is supported:

```
"~/Documents" → "/home/user/Documents"
```

---

## Media Tool

Control MPD (Music Player Daemon).

### Playback Control

| Action | Description |
|--------|-------------|
| `play` | Start playback |
| `pause` | Pause playback |
| `toggle` | Toggle play/pause |
| `stop` | Stop playback |
| `next` | Next track |
| `prev` | Previous track |

### Volume Control

| Action | Description |
|--------|-------------|
| `volume <level>` | Set volume (-100 to 100) |

```json
{"tool": "media", "args": "volume 50"}
{"tool": "media", "args": "volume -10"}
```

### Information

| Action | Description |
|--------|-------------|
| `current` | Show current track |
| `queue` | Show playlist |

### Search

```json
{"tool": "media", "args": "search artist \"Radiohead\""}
```

### Examples

```json
{"tool": "media", "args": "toggle"}
{"tool": "media", "args": "next"}
{"tool": "media", "args": "volume 50"}
{"tool": "media", "args": "current"}
```

---

## Clipboard Tool

Manage clipboard via Clipcat.

### Operations

| Action | Description |
|--------|-------------|
| `get` | Get clipboard content |
| `list` | List clipboard history |
| `set <text>` | Set clipboard content |
| `clear` | Clear clipboard history |

### Examples

```json
{"tool": "clipboard", "args": "get"}
{"tool": "clipboard", "args": "list"}
{"tool": "clipboard", "args": "set Copy this text"}
{"tool": "clipboard", "args": "clear"}
```

---

## Notify Tool

Send desktop notifications via Dunst.

### Format

```
title|body|urgency
```

### Urgency Levels

| Level | Description | Color |
|-------|-------------|-------|
| `low` | Low priority | Yellow |
| `normal` | Standard | Blue |
| `critical` | Urgent | Red |

### Examples

```json
{"tool": "notify", "args": "Task Complete|File processed|normal"}
{"tool": "notify", "args": "Error|Operation failed|critical"}
{"tool": "notify", "args": "Reminder|Meeting in 5 minutes|low"}
```

---

## Terminal Tool

Execute shell commands with security checks.

### Usage

```json
{"tool": "terminal", "args": "ls -la ~/Documents"}
```

### Security

- Commands are analyzed for dangerous patterns
- Dangerous commands require confirmation
- 30-second timeout protection

### Examples

```json
{"tool": "terminal", "args": "ls -la ~/Downloads"}
{"tool": "terminal", "args": "echo 'Hello World'"}
{"tool": "terminal", "args": "df -h"}
```

---

## Creating Custom Tools

### Step 1: Create Handler

Create a new file in `src/tools/`:

```typescript
// src/tools/custom.ts
import { logger } from "../logger";

export async function custom(action: string): Promise<string> {
  logger.info("custom", `Action: ${action}`);
  
  try {
    // Your implementation
    return "✓ Success";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("custom", `Failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}
```

### Step 2: Export from Index

Add to `src/tools/index.ts`:

```typescript
export { custom } from "./custom";
```

### Step 3: Register Tool

Add to `src/tools/registry.ts`:

```typescript
import { custom } from "./custom";
registerTool("custom", custom);
```

### Step 4: Update System Prompt

Add tool description to `src/ai/prompts.ts`.

---

## Tool Execution Flow

```
User Input: "open telegram"
        │
        ▼
AI generates: {"tool": "app", "args": "telegram"}
        │
        ▼
Planner.parseToolCalls() extracts JSON
        │
        ▼
dispatchTool("app", "telegram")
        │
        ▼
app("telegram") executes
        │
        ▼
Returns: "✓ Telegram launched"
```

---

## Related Documentation

- **[API Reference](08-api-reference.md)** — Tool API documentation
- **[Security](09-security.md)** — Security features
- **[Development Guide](10-development.md)** — Creating tools

---

← Previous: [Usage Guide](06-usage-guide.md) | Next: [API Reference](08-api-reference.md) →