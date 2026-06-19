# 07 - Tools Reference

Complete documentation for all available tools in DeskLumina's contract-driven automation system.

---

## Table of Contents

- [Overview](#overview)
- [Application Tool (app)](#application-tool-app)
- [File Tool (file)](#file-tool-file)
- [Music Tool (music)](#music-tool-music)
- [Clipboard Tool (clipboard)](#clipboard-tool-clipboard)
- [Terminal Tool (terminal)](#terminal-tool-terminal)
- [Notification Tool (notify)](#notification-tool-notify)
- [Math Tool (math)](#math-tool-math)

---

## Overview

DeskLumina uses a **Contract-Driven** tool architecture. Each tool's behavior, schema, and failure logic are defined in `src/tools/contracts/contracts.ts`, which the system uses to generate prompts.

### Tool Call Format

```json
{"tool": "tool_name", "args": "arguments_string"}
```

Tool calls are parsed from markdown code blocks. Arguments are passed as a single string (or a JSON-string for complex tools like `music`).

---

## Application Tool (`app`)

Launch GUI application by alias. This tool runs **non-blocking**. The agent receives immediate confirmation and the app launches in the background. The actual launch result is available on the next turn.

- **Schema**: `app <alias>`
- **Quoting**: Strictly forbidden. The parser fails if quotes are detected.
- **Escaping**: None. Raw string only.

### Examples:
- `{"tool": "app", "args": "firefox"}`
- `{"tool": "app", "args": "code"}`

### Default Aliases:
Aliases are defined in `src/config/apps.json`. Common ones include `browser`, `terminal`, `files`, `tg`, and `nvim`.

---

## File Tool (`file`)

Filesystem operations and indexed search.

- **Schema**: `file <op> <args>`
- **Quoting**: Paths or content with spaces MUST be enclosed in double quotes. Single quotes are not supported.
- **Escaping**: Standard backslash escaping for quotes in paths/content. `\n` is supported in `write`.
- **Path Rules**:
  - Absolute and relative paths supported.
  - Tilde (`~`) expansion supported.
  - Normalization: Standard path normalization applied.
- **Read Limit**: The `read` operation loads at most 512 KiB into memory. Larger files are rejected with exit code `413`.
- **Path Safety**: Operations targeting a system-critical path (`/`, `/bin`, `/boot`, `/dev`, `/etc`, `/lib`, `/proc`, `/root`, `/run`, `/sbin`, `/sys`, `/usr`, `/var`) trigger a Rofi confirmation before execution. The `delete` operation also refuses `/` and the user's `$HOME`.

### Operations:

| Operation | Arguments | Description |
|-----------|-----------|-------------|
| `read` | `<path>` | Read file content (max 512 KiB). |
| `write` | `<path> [content]` | Write text to file. Creates an empty file when no content is provided. |
| `list` | `[path]` | List directory contents. |
| `create_dir`| `<path>` | Create directory (recursive). |
| `move` | `<src> <dest>` | Move file or directory. |
| `copy` | `<src> <dest>` | Copy file or directory. |
| `delete` | `<path>` | Recursively delete file or directory. |
| `rename` | `<src> <new_name>` | Rename a file inside its current directory. The new name must not contain path separators. |
| `touch` | `<path>` | Create an empty file or update the mtime of an existing one. |
| `stat` | `<path>` | Return structured metadata (type, size, permissions, owner, timestamps) as JSON. |
| `chmod` | `<path> <mode>` | Change permissions. `mode` is either an octal value (`600`) or a symbolic expression (`u+x`). |
| `chown` | `<path> <owner>[:<group>]` | Change ownership. `owner` may be a user name or `user:group` pair. |
| `preview` | `<path>` | Smart preview: returns the first 8 KiB of a text file, the first 20 entries of a directory, or a binary/missing indicator. |
| `search_name`| `"<query>" [filters]` | Indexed search by filename substring. |
| `search_path`| `"<query>" [filters]` | Indexed search by full path substring. |
| `search_pattern`| `"<regex>" [filters]` | Indexed search using a POSIX extended regex. |
| `find` | `<base> <query>` | Legacy alias for `search_name` with an explicit base path. |
| `history` | `[limit]` | Show recent search history (default 10 entries). |
| `repeat_last`| none | Replay the most recent search from history. |

### Search Filters:

Filters use `key=value` syntax after the query.

| Filter | Values | Description |
|--------|--------|-------------|
| `base` | `<path>` | Restrict search to this base directory. |
| `type` | `file\|directory\|any` | Restrict results by entry type. |
| `ext` | `md,txt` | Comma-separated extension list. |
| `hidden` | `true\|false` | Include or exclude hidden files. |
| `limit` | `1-200` | Max results to return. |
| `select` | `true\|false` | Trigger interactive `fzf` selection. Requires a TTY. |
| `preview` | `true\|false` | Automatically include a preview of the top match (or the user-selected file when combined with `select=true`). |

### Search Backend

`search_name`, `search_path`, and `search_pattern` prefer the system `locate` command (case-insensitive, indexed). If `locate` is not installed, the tool transparently falls back to `find`:

- `search_name` → `find <base> -maxdepth 5 -iname "*<query>*"`
- `search_path` → `find <base> -maxdepth 5 -iname "*<query>*"`
- `search_pattern` → `find <base> -maxdepth 5 -regextype posix-extended -regex <query>`

Search history (up to 25 entries) is persisted to `$XDG_STATE_HOME/desklumina/file-search-history.json` (default `~/.local/state/desklumina/file-search-history.json`) and replayed by `repeat_last`.

### Examples:
- `{"tool": "file", "args": "read ~/todo.md"}`
- `{"tool": "file", "args": "write \"/tmp/test.txt\" \"Line 1\\nLine 2\""}`
- `{"tool": "file", "args": "rename ~/notes/old.txt new.txt"}`
- `{"tool": "file", "args": "stat ~/project"}`
- `{"tool": "file", "args": "search_name \"config\" base=~/.config limit=5 select=true"}`

---

## Music Tool (`music`)

Control media playback and inspect current track status using a JSON payload. Before performing playback-affecting actions (play, pause, etc.), the agent typically performs a track query to resolve the active backend.

- **Schema**: `music {"action"?: "...", "backend"?: "...", "current"?: boolean, "backends"?: [...]}`
- **Quoting**: Arguments MUST be a valid JSON object string. Double quotes for keys and values.
- **Escaping**: JSON-standard backslash escaping for quotes in payload.

### Parameters:
- **`action`**: `play`, `resume`, `pause`, `stop`, `next`, `prev`, `volume_up`, `volume_down`.
- **`current`**: Set to `true` to query active track information.
- **`backend`**: Explicitly target `mpc` or `playerctl`.
- **`backends`**: List of backends to query (e.g., `["all"]`, `["mpc"]`).

### Examples:
- `{"tool": "music", "args": "{\"current\": true}"}`
- `{"tool": "music", "args": "{\"action\": \"play\", \"backend\": \"mpc\"}"}`
- `{"tool": "music", "args": "{\"action\": \"pause\", \"backend\": \"playerctl\"}"}`
- `{"tool": "music", "args": "{\"action\": \"volume_up\"}"}`

---

## Clipboard Tool (`clipboard`)

Manage clipboard history via `clipcat`.

- **Schema**: `clipboard get <ID> | list | clear | set <text>`
- **Quoting**: Forbidden for command names. `set` content should not be quoted.
- **Escaping**: None for commands. `set` captures all trailing text verbatim.

### Examples:
- `{"tool": "clipboard", "args": "list"}`
- `{"tool": "clipboard", "args": "set Important note"}`
- `{"tool": "clipboard", "args": "get c12345b234c5a1b"}`

---

## Terminal Tool (`terminal`)

Execute a bash command. The terminal tool uses a **command classifier** to determine execution mode per-call:

- **Schema**: `terminal <command>`
- **Quoting**: Do not quote the whole command. Internal quotes must be escaped for bash.
- **Escaping**: Standard bash escaping for internal characters. Tool arg itself is raw.

### Execution Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Non-blocking** | Known GUI app (e.g., `firefox`, `code`, `mpv`) or command ending with `&` | Process is spawned detached; the agent receives immediate confirmation and continues. Result is available on the next turn. |
| **Blocking** | Default for CLI commands | stdout/stderr/exitCode are captured with a hard timeout. The agent waits for completion. |
| **Rejected** | Empty command or interactive `ssh` without a remote command | Returns an error without executing. |

### Automatic Rewrites

The classifier automatically appends non-interactive flags to package manager install commands:
- `apt install` / `apt-get install` → `-y`
- `dnf install` → `-y`
- `yum install` → `-y`
- `pacman -S` → `--noconfirm`

### Examples:
- `{"tool": "terminal", "args": "ls -la"}`: **blocking**, captures output
- `{"tool": "terminal", "args": "firefox"}`: **non-blocking**, fire-and-forget
- `{"tool": "terminal", "args": "sleep 60 &"}`: **non-blocking**, trailing `&`
- `{"tool": "terminal", "args": "ssh user@host"}`: **rejected**, interactive ssh
- `{"tool": "terminal", "args": "sudo apt install vim"}`: **blocking**, rewritten to `sudo apt install -y vim`

---

## Notification Tool (`notify`)

Send desktop notifications. This tool runs **non-blocking**, using fire-and-forget execution.

- **Schema**: `notify <title>|<body>|<urgency>`
- **Quoting**: Forbidden. Quotes in title/body are treated as literal characters.
- **Escaping**: None. Pipe (`|`) is the literal delimiter.

### Urgency Levels:
`low`, `normal`, `critical`.

### Examples:
- `{"tool": "notify", "args": "Title|Message|normal"}`
- `{"tool": "notify", "args": "Alert|System offline|critical"}`

---

## Math Tool (`math`)

Evaluate mathematical expressions, equations, and unit conversions securely in-process.

- **Schema**: `math <expression>`
- **Quoting**: Forbidden. The parser treats quotes as literal characters and may fail.
- **Escaping**: None. Raw expression string only.
- **Security**: Executed fully in-process without shell invocation. Blocks shell patterns like `$()`, backticks, and pipes.

### Features:
- **Precision**: 10 significant figures by default.
- **Formatting**: Automatic scientific notation for extremely large (`>= 1e15`) or small (`< 1e-10`) values.
- **Syntactic Sugar**: Supports `X% of Y` (e.g., `15% of 340`).
- **Units**: Supports unit conversions (e.g., `100 km to miles`).
- **Functions**: Full support for trigonometry, statistics, logarithms, and more.
- **Prime Factorization**: Built-in `factor()` function (e.g., `factor(360)` returns `2^3 x 3^2 x 5`).

### Examples:
- `{"tool": "math", "args": "2 + 2"}`
- `{"tool": "math", "args": "sqrt(144) * sin(pi / 4)"}`
- `{"tool": "math", "args": "15% of 340"}`
- `{"tool": "math", "args": "mean([12, 45, 33, 28, 51])"}`
- `{"tool": "math", "args": "100 km to miles"}`
- `{"tool": "math", "args": "factor(360)"}`

---

## Next Steps

- 🛡️ **[Security Guide](09-security.md)**: Learn about safe execution and confirmation.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Background service and tool performance.
- 🛠️ **[Development Guide](10-development.md)**: Learn how to define new Tool Contracts.

---

[← Usage Guide](06-usage-guide.md) | [Security →](09-security.md)
