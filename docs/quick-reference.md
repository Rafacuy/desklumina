# Quick Reference

## Launch Modes

| Mode | Command | Description |
| --- | --- | --- |
| Rofi UI | `bun run start` | Interactive graphical chat |
| Terminal | `bun run dev` | Persistent shell chat loop |
| Daemon (start) | `bun run daemon:start` | Run background service |
| Daemon (send) | `bun run send "..."` | Send request to background daemon |
| One-off | `bun run start -- --exec "..."` | Execute single request and exit |

## Rofi Shortcuts

These shortcuts apply when the main input window or error panel is focused.

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Submit message |
| <kbd>Tab</kbd> | Open History / Settings menu |
| <kbd>Esc</kbd> | Exit UI |
| <kbd>Alt</kbd>+<kbd>R</kbd> | Retry failed request |
| <kbd>Alt</kbd>+<kbd>C</kbd> | Copy error string to clipboard |

## Configuration Files

| File | Purpose |
| --- | --- |
| `.env` | API keys, primary model (`DESKLUMINA_MODEL`), fallback chains (`DESKLUMINA_FALLBACKS`) |
| `settings.json` | UI language, dark mode, TTS preferences, default web search provider, LTM toggles |
| `models.json` | Alternative to `.env` for complex model logic (primary, fallbacks, aliases) |
| `src/config/apps.json` | Natural language application aliases mapped to system binaries |
| `src/ui/themes/lumina.rasi` | Light theme (colors, fonts) |
| `src/ui/themes/lumina-dark.rasi` | Dark theme variant |


