# 🔧 Tool System Documentation

Complete guide to DeskLumina's tool system for desktop automation.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Tool Call Format](#tool-call-format)
- [Available Tools](#available-tools)
- [Application Aliases](#application-aliases)
- [BSPWM Actions](#bspwm-actions)
- [File Operations](#file-operations)
- [Media Commands](#media-commands)
- [Clipboard Operations](#clipboard-operations)
- [Notifications](#notifications)
- [Creating Custom Tools](#creating-custom-tools)

---

## 📖 Overview

DeskLumina uses **JSON-based tool calls** embedded in markdown code blocks. The AI generates these tool calls, which are then parsed and executed to automate desktop tasks.

### Tool Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   User      │────▶│     AI       │────▶│   Parser    │────▶│   Executor   │
│   Input     │     │  Response    │     │             │     │              │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                              │                   │
                                              ▼                   ▼
                                        ┌──────────────┐     ┌──────────────┐
                                        │  Markdown    │     │   Desktop    │
                                        │  Extraction  │     │   Action     │
                                        └──────────────┘     └──────────────┘
```

---

## 📝 Tool Call Format

### Single Tool Call

```json
{"tool": "app", "args": "browser"}
```

### Multiple Tool Calls

```json
[
  {"tool": "bspwm", "args": "focus_workspace 3"},
  {"tool": "app", "args": "browser"}
]
```

### In AI Response

The AI embeds tool calls in markdown code blocks:

```markdown
I'll open the browser for you.

```json
{"tool": "app", "args": "browser"}
```
```

---

## 🛠️ Available Tools

| Tool | Description | Handler |
|------|-------------|---------|
| `app` | Launch applications | `src/tools/apps.ts` |
| `terminal` | Execute shell commands | `src/tools/terminal.ts` |
| `bspwm` | Window/workspace management | `src/tools/bspwm.ts` |
| `file` | File operations | `src/tools/files.ts` |
| `media` | Music player control | `src/tools/media.ts` |
| `clipboard` | Clipboard management | `src/tools/clipboard.ts` |
| `notify` | Desktop notifications | `src/tools/notify.ts` |

---

## 📀 Application Aliases

The `app` tool supports these aliases:

### Terminal Emulators

| Alias | Application | Command |
|-------|-------------|---------|
| `terminal`, `term` | Alacritty | `alacritty` |
| `kitty` | Kitty Terminal | `kitty` |

### Browsers

| Alias | Application | Command |
|-------|-------------|---------|
| `browser` | Default Browser | `xdg-open https://` |
| `chrome` | Google Chrome | `google-chrome-stable` |

### File Managers

| Alias | Application | Command |
|-------|-------------|---------|
| `files`, `thunar` | Thunar | `thunar` |
| `yazi` | Yazi TUI | `alacritty -e yazi` |

### Editors

| Alias | Application | Command |
|-------|-------------|---------|
| `editor`, `geany` | Geany | `geany` |
| `neovim`, `nvim` | Neovim | `alacritty -e nvim` |

### Communication

| Alias | Application | Command |
|-------|-------------|---------|
| `telegram`, `tg` | Telegram | `telegram-desktop` |
| `whatsapp`, `wa` | WhatsApp Web | `xdg-open https://web.whatsapp.com` |

### Web Services

| Alias | Application | Command |
|-------|-------------|---------|
| `youtube`, `yt` | YouTube | `xdg-open https://youtube.com` |
| `github` | GitHub | `xdg-open https://github.com` |
| `spotify` | Spotify Web | `xdg-open https://open.spotify.com` |

### System Tools

| Alias | Application | Command |
|-------|-------------|---------|
| `music`, `ncmpcpp` | NCMPCPP | `alacritty -e ncmpcpp` |
| `pavucontrol`, `volume` | PulseAudio Control | `pavucontrol` |
| `bluetooth` | Bluetooth Manager | `blueman-manager` |
| `btop` | BTop Monitor | `alacritty -e btop` |
| `htop` | HTop Monitor | `alacritty -e htop` |

### Usage Examples

```json
{"tool": "app", "args": "telegram"}
{"tool": "app", "args": "nvim"}
{"tool": "app", "args": "browser"}
```

---

## 🖥️ BSPWM Actions

The `bspwm` tool controls window management and workspaces.

### Workspace Management

| Action | Description | Command |
|--------|-------------|---------|
| `focus_workspace <n>` | Switch to workspace | `bspc desktop -f ^<n>` |
| `move_window_to <n>` | Move window to workspace | `bspc node -d ^<n>` |
| `list_workspaces` | List all workspaces | `bspc query -D` |

### Window Management

| Action | Description | Command |
|--------|-------------|---------|
| `close_focused` | Close focused window | `bspc node -c` |
| `kill_focused` | Kill focused window | `bspc node -k` |
| `toggle_fullscreen` | Toggle fullscreen | `bspc node -t fullscreen` |
| `toggle_floating` | Toggle floating mode | `bspc node -t floating` |
| `toggle_monocle` | Toggle monocle layout | `bspc desktop -l monocle` |
| `get_focused_window` | Get focused window ID | `bspc query -N -n focused` |
| `list_windows` | List windows | `bspc query -N -d` |

### Focus Navigation

| Action | Description | Command |
|--------|-------------|---------|
| `focus_north` | Focus window above | `bspc node -f north` |
| `focus_south` | Focus window below | `bspc node -f south` |
| `focus_east` | Focus window right | `bspc node -f east` |
| `focus_west` | Focus window left | `bspc node -f west` |

### Desktop Operations

| Action | Description | Command |
|--------|-------------|---------|
| `rotate_desktop` | Rotate 90° | `bspc node @/ -R 90` |
| `reload_sxhkd` | Reload keybindings | `pkill -USR1 sxhkd` |
| `reload_bspwm` | Reload WM | `bspc wm -r` |

### Special Actions

#### `wait_and_move <class> <workspace>`

Wait for a window to appear and move it to a workspace.

```json
{"tool": "bspwm", "args": "wait_and_move firefox 2"}
```

**Behavior:**
1. Waits up to 5 seconds for window with class `<class>`
2. Moves window to workspace `<workspace>`
3. Returns success or timeout message

### Usage Examples

```json
{"tool": "bspwm", "args": "focus_workspace 3"}
{"tool": "bspwm", "args": "move_window_to 2"}
{"tool": "bspwm", "args": "toggle_fullscreen"}
{"tool": "bspwm", "args": "wait_and_move chrome 1"}
```

---

## 📁 File Operations

The `file` tool handles file system operations with safety checks.

### Operations

#### `create_dir <path>`

Create a directory.

```json
{"tool": "file", "args": "create_dir ~/Projects/NewProject"}
```

**Returns:** `✓ Folder "/home/user/Projects/NewProject" dibuat`

---

#### `delete <path>`

Delete a file or folder.

```json
{"tool": "file", "args": "delete ~/temp.txt"}
```

**Safety:**
- Blocks deletion of `/`, home directory, and system paths
- Requires confirmation for dangerous paths

**Returns:** `✓ "/home/user/temp.txt" dihapus`

---

#### `move <src> <dest>`

Move or rename a file.

```json
{"tool": "file", "args": "move file.txt newfile.txt"}
```

**Returns:** `✓ Dipindah ke "newfile.txt"`

---

#### `copy <src> <dest>`

Copy a file or folder.

```json
{"tool": "file", "args": "copy document.txt ~/backup/"}
```

**Returns:** `✓ Disalin ke "/home/user/backup/"`

---

#### `list <path>`

List directory contents.

```json
{"tool": "file", "args": "list ~/Downloads"}
```

**Returns:** Directory listing (like `ls -la`)

---

#### `read <path>`

Read file content.

```json
{"tool": "file", "args": "read config.json"}
```

**Returns:** File contents

---

#### `write <path> <content>`

Write content to a file.

```json
{"tool": "file", "args": "write notes.txt Hello World"}
```

**Note:** Content is everything after the path.

**Returns:** `✓ File "notes.txt" ditulis`

---

#### `find <path> <pattern>`

Find files by name pattern.

```json
{"tool": "file", "args": "find ~/Documents *.pdf"}
```

**Returns:** Matching file paths

---

### Path Handling

**Tilde Expansion:**
```typescript
"~/Documents" → "/home/user/Documents"
```

**Dangerous Paths (blocked):**
- `/`, `/bin`, `/boot`, `/dev`
- `/etc`, `/lib`, `/root`
- `/sys`, `/usr`, `/var`

---

## 🎵 Media Commands

The `media` tool controls MPD (Music Player Daemon).

### Playback Control

| Action | Description | Command |
|--------|-------------|---------|
| `play` | Start playback | `mpc play` |
| `pause` | Pause playback | `mpc pause` |
| `toggle` | Toggle play/pause | `mpc toggle` |
| `stop` | Stop playback | `mpc stop` |
| `next` | Next track | `mpc next` |
| `prev` | Previous track | `mpc prev` |

### Volume Control

| Action | Description | Range |
|--------|-------------|-------|
| `volume <level>` | Set volume | -100 to 100 |

```json
{"tool": "media", "args": "volume 50"}
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

### Usage Examples

```json
{"tool": "media", "args": "toggle"}
{"tool": "media", "args": "next"}
{"tool": "media", "args": "volume -10"}
{"tool": "media", "args": "current"}
```

---

## 📋 Clipboard Operations

The `clipboard` tool manages clipboard via Clipcat.

### Operations

| Action | Description | Example |
|--------|-------------|---------|
| `get` | Get clipboard content | `{"tool": "clipboard", "args": "get"}` |
| `list` | List clipboard history | `{"tool": "clipboard", "args": "list"}` |
| `set <text>` | Set clipboard | `{"tool": "clipboard", "args": "set Hello"}` |
| `clear` | Clear history | `{"tool": "clipboard", "args": "clear"}` |

### Usage Examples

```json
{"tool": "clipboard", "args": "get"}
{"tool": "clipboard", "args": "list"}
{"tool": "clipboard", "args": "set Copy this text"}
{"tool": "clipboard", "args": "clear"}
```

---

## 🔔 Notifications

The `notify` tool sends desktop notifications via Dunst.

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

### Usage Examples

```json
{"tool": "notify", "args": "Task Complete|Your file has been processed|normal"}
{"tool": "notify", "args": "Error|Operation failed|critical"}
{"tool": "notify", "args": "Reminder|Meeting in 5 minutes|low"}
```

---

## 🧪 Creating Custom Tools

### Step 1: Create Tool Handler

Create a new file in `src/tools/`:

```typescript
// src/tools/custom.ts
import { execute } from "./terminal";
import { logger } from "../logger";

export async function custom(action: string): Promise<string> {
  logger.info("custom", `Action: ${action}`);
  
  try {
    // Your implementation
    const result = await execute(`echo "${action}"`);
    
    if (result.exitCode !== 0) {
      return `❌ Error: ${result.stderr}`;
    }
    
    return `✓ Success: ${result.stdout}`;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("custom", `Operation failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}
```

---

### Step 2: Export from Tools Index

Add to `src/tools/index.ts`:

```typescript
export { custom } from "./custom";
```

---

### Step 3: Register Tool (Optional)

Add to `src/tools/registry.ts`:

```typescript
import { registerTool } from "./registry";
import { custom } from "./custom";

registerTool("custom", custom);
```

---

### Step 4: Update System Prompt

Add tool description to `src/ai/prompts.ts`:

```typescript
• custom: Custom tool description
```

---

### Tool Handler Template

```typescript
import { logger } from "../logger";

export async function toolName(action: string): Promise<string> {
  logger.info("toolName", `Action: ${action}`);
  
  try {
    // Validate input
    if (!action) {
      return "❌ Missing required argument";
    }
    
    // Implementation
    // ...
    
    return "✓ Success message";
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("toolName", `Failed: ${err.message}`, err);
    return `❌ Error: ${err.message}`;
  }
}
```

---

## 📊 Tool Execution Flow

1. **AI generates tool call** in JSON format
2. **Parser extracts** tool calls from markdown
3. **Dispatcher routes** to appropriate handler
4. **Handler executes** the action
5. **Result returned** to AI for response

---

## 🔗 Related Documentation

- [API Reference](./API.md) - Core API documentation
- [Development Guide](./DEVELOPMENT.md) - Development workflow
- [Security Documentation](./SECURITY.md) - Security features

---

<div align="center">

**Need more help?** Check the [API Reference](./API.md) for programmatic usage.

</div>
