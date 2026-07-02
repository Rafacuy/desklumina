# Tools Reference

DeskLumina interacts with your system through strict, contract-driven tools.[^1]

All tools receive arguments as a single string. Complex tools use JSON strings, which DeskLumina parses from markdown code blocks in the assistant's stream.

## Contents

- [app](#app)
- [terminal](#terminal)
- [file](#file)
- [music](#music)
- [clipboard](#clipboard)
- [notify](#notify)
- [math](#math)
- [web\_search](#web_search)

[^1]: `src/tools/contracts/contracts.ts`

## app

Launches GUI applications. Runs in the background (fire-and-forget).

| Property | Value |
| --- | --- |
| Schema | `app <alias>` |
| Example | `{"tool": "app", "args": "firefox"}` |
| Alias resolution | `src/config/apps.json` |

Quoting the alias is forbidden. Aliases resolve against the app registry; see [App Aliases](./configuration.md#app-aliases-appsjson) to add your own.

## terminal

Executes bash commands.

| Property | Value |
| --- | --- |
| Schema | `terminal <command>` |
| Example | `{"tool": "terminal", "args": "ls -la"}` |

Known GUI binaries (like `code`) or commands ending in `&` run detached. All other commands block and wait for output. Do not quote the entire command string; escaping follows standard bash rules.

> [!WARNING]
> High-risk operations (`rm -rf`, `sudo`, `dd`, and others) trigger a confirmation dialog before execution. See [Security](./security.md#terminal-command-scanning) for the full severity classification.

## file

Performs filesystem operations and indexed searches.

| Property | Value |
| --- | --- |
| Schema | `file <op> <args>` |
| Example | `{"tool": "file", "args": "read \"~/notes.txt\""}` |

Paths containing spaces must be enclosed in double quotes.

Supported operations:

| Category | Operations |
| --- | --- |
| Basic | `read`, `write`, `list`, `create_dir`, `move`, `copy`, `delete`, `rename`, `touch`, `stat`, `chmod`, `chown`, `preview` |
| Search | `search_name`, `search_path`, `search_pattern` |

Search uses system `locate` for speed, falling back to `find` if `locate` is not available. Supports filters like `base=~ limit=10 select=true`.

## music

Controls media playback via MPC or Playerctl backends.

| Property | Value |
| --- | --- |
| Schema | `music {"action"?: "...", "backend"?: "...", "current"?: boolean}` |
| Example | `{"tool": "music", "args": "{\"action\": \"play\"}"}` |

Arguments must be a valid JSON object string. The agent typically performs a track query (`{"current": true}`) before issuing playback commands to resolve the active backend.

Supported actions: `play`, `pause`, `stop`, `next`, `prev`, `volume_up`, `volume_down`.

## clipboard

Manages clipboard history via `clipcat`.

| Property | Value |
| --- | --- |
| Schema | `clipboard get <ID> \| list \| clear \| set <text>` |
| Example | `{"tool": "clipboard", "args": "set Save this text"}` |

Do not quote command verbs. The `set` operation captures all trailing text verbatim.

## notify

Sends desktop notifications. Runs non-blocking.

| Property | Value |
| --- | --- |
| Schema | `notify <title>\|<body>\|<urgency>` |
| Example | `{"tool": "notify", "args": "Alert\|System offline\|critical"}` |

Quoting is forbidden. The pipe `|` is the strict literal delimiter between fields.

## math

Evaluates mathematical expressions natively without invoking a shell.

| Property | Value |
| --- | --- |
| Schema | `math <expression>` |
| Example | `{"tool": "math", "args": "15% of 340"}` |

Quoting is forbidden. Supports trigonometry, statistics, unit conversion (e.g. `100 km to miles`), and prime factorization.

## web_search

Queries the internet for current facts, news, and images.

| Property | Value |
| --- | --- |
| Schema | `web_search {"query": string, "provider"?: string, "type"?: string}` |
| Example | `{"tool": "web_search", "args": "{\"query\": \"latest linux kernel\"}"}` |

Arguments must be a valid JSON object string. Supported providers: Serper, Serpapi, Searxng, Tavily. The tool auto-falls back on rate limits.
