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

---

## Overview

DeskLumina uses a **Contract-Driven** tool architecture. Each tool's behavior, schema, and failure logic are defined in `src/tools/contracts.ts`, which the system uses to generate deterministic prompts.

### Tool Call Format

```json
{"tool": "tool_name", "args": "arguments_string"}
```

Tool calls are parsed from markdown code blocks. Arguments are passed as a single string (or a JSON-string for complex tools like `music`).

---

## Application Tool (`app`)

Launch GUI application by alias.

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

### Operations:

| Operation | Arguments | Description |
|-----------|-----------|-------------|
| `read` | `<path>` | Read file content. |
| `write` | `<path> "<content>"` | Write text to file. |
| `list` | `[path]` | List directory contents. |
| `create_dir`| `<path>` | Create directory (recursive). |
| `move` | `<src> <dest>` | Move/rename file or directory. |
| `copy` | `<src> <dest>` | Copy file or directory. |
| `delete` | `<path>` | Delete file or directory. |
| `preview` | `<path>` | Smart preview (text snippet or folder list). |
| `search_name`| `"<query>" [filters]` | Indexed search by filename. |
| `search_path`| `"<query>" [filters]` | Indexed search by full path. |
| `search_pattern`| `"<regex>" [filters]` | Indexed search using regex. |
| `history` | `[limit]` | Show recent search history. |
| `repeat_last`| none | Repeat the last successful search. |

### Search Filters:

Filters use `key=value` syntax after the query.

| Filter | Values | Description |
|--------|--------|-------------|
| `base` | `<path>` | Restrict search to this base directory. |
| `type` | `file\|directory\|any` | Restrict results by entry type. |
| `ext` | `md,txt` | Comma-separated extension list. |
| `hidden` | `true\|false` | Include or exclude hidden files. |
| `limit` | `1-200` | Max results to return. |
| `select` | `true\|false` | Trigger interactive `fzf` selection (CLI mode). |
| `preview` | `true\|false` | Automatically include a preview of the best match. |

### Examples:
- `{"tool": "file", "args": "read ~/todo.md"}`
- `{"tool": "file", "args": "write \"/tmp/test.txt\" \"Line 1\\nLine 2\""}`
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

Execute a bash command.

- **Schema**: `terminal <command>`
- **Quoting**: Do not quote the whole command. Internal quotes must be escaped for bash.
- **Escaping**: Standard bash escaping for internal characters. Tool arg itself is raw.

### Examples:
- `{"tool": "terminal", "args": "ls -la"}`
- `{"tool": "terminal", "args": "pactl get-sink-volume @DEFAULT_SINK@"}`

---

## Notification Tool (`notify`)

Send desktop notifications.

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

### Examples:
- `{"tool": "math", "args": "2 + 2"}`
- `{"tool": "math", "args": "sqrt(144) * sin(pi / 4)"}`
- `{"tool": "math", "args": "15% of 340"}`
- `{"tool": "math", "args": "mean([12, 45, 33, 28, 51])"}`
- `{"tool": "math", "args": "100 km to miles"}`

---

## Next Steps

- 🛡️ **[Security Guide](09-security.md)**: Learn about safe execution and confirmation.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Background service and tool performance.
- 🛠️ **[Development Guide](10-development.md)**: Learn how to define new Tool Contracts.

---

[← Usage Guide](06-usage-guide.md) | [Security →](09-security.md)
