# DeskLumina

Linux desktop automation agent built with Bun + TypeScript. DeskLumina sends your messages to the Groq Chat Completions API, streams the model output, parses JSON tool calls from markdown code fences, and executes a fixed set of local tools.

## Requirements

### Required

- **Bun**: used to run `src/main.ts` (`bun run start`).
- **Groq API credentials**: `.env` must define `GROQ_API_KEY` and `MODEL_NAME`.
- **Rofi**: used for the default interactive UI and security confirmations.

### Optional (feature-dependent)

- **MPD/MPC**: `media` tool shells out to `mpc` (e.g. `mpc play`, `mpc toggle`).
- **clipcat**: `clipboard` tool shells out to `clipcatctl`.
- **dunst**: `notify` tool shells out to `dunstify`.

## Install

```bash
git clone https://github.com/Rafacuy/desklumina.git ~/.config/desklumina
cd ~/.config/desklumina

bun install
cp .env.example .env
```

## Run

All modes are implemented in `src/main.ts` and selected by the first CLI argument.

| Mode | Command | Notes |
|------|---------|------|
| Rofi UI (default) | `bun run start` | Starts the Rofi chat loop. |
| Terminal chat loop | `bun run dev` | Runs `src/main.ts --chat`. |
| One-off execution | `bun run start -- --exec "open telegram"` | Runs a single message and prints the assistant text. |
| Daemon | `bun run daemon` | Serves `~/.config/desklumina/daemon.sock` (HTTP over Unix socket). |
| Daemon status | `bun run daemon:status` | Checks whether the socket file exists. |
| Send to daemon | `bun run send "open telegram"` | Sends `cmd=...` to the daemon over the Unix socket. |

## Documentation

- `docs/01-introduction.md`
- `docs/02-installation.md`
- `docs/03-quick-start.md`
- `docs/04-configuration.md`
- `docs/05-architecture.md`
- `docs/06-usage-guide.md`
- `docs/07-tools-reference.md`
- `docs/08-api-reference.md`
- `docs/09-security.md`
- `docs/10-development.md`
- `docs/11-daemon-mode.md`
- `docs/12-testing.md`
- `docs/13-troubleshooting.md`
- `docs/14-faq.md`
- `docs/15-contributing.md`
- `docs/16-roadmap.md`

## License

MIT (see `LICENSE`).
