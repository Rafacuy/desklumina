# 13 - Troubleshooting

Quick fixes for common issues encountered while using or installing DeskLumina.

---

## Table of Contents

- [AI & API Issues](#ai--api-issues)
- [UI & Rofi Issues](#ui--rofi-issues)
- [Tool Execution Issues](#tool-execution-issues)
- [Daemon & Socket Issues](#daemon--socket-issues)
- [TTS & Audio Issues](#tts--audio-issues)

---

## AI & API Issues

### `401 Unauthorized` / Invalid API Key
- **Symptom**: AI responses fail with an authorization error.
- **Fix**: Check your `.env` file. Ensure `GROQ_API_KEY` is set correctly and has no leading/trailing spaces.

### Slow Responses / High Latency
- **Symptom**: The assistant takes several seconds to respond.
- **Fix**: 
  - Check your internet connection.
  - Verify the Groq service status at [status.groq.com](https://status.groq.com/).

---

## UI & Rofi Issues

### Rofi Doesn't Appear
- **Symptom**: Running `bun run start` returns to the terminal immediately.
- **Fix**: 
  - Ensure `rofi` is installed: `which rofi`.
  - Check for syntax errors in your `.rasi` theme file (`src/ui/themes/lumina.rasi`).

### Rofi Theme Looks Broken
- **Symptom**: Colors are missing or the layout is shifted.
- **Fix**: The included `.rasi` theme expects a modern version of Rofi. If you are on an older distribution, you may need to simplify the theme or use the default one.

---

## Tool Execution Issues

### "Tool Not Found"
- **Symptom**: AI says it's executing a tool, but nothing happens.
- **Fix**: Check `src/tools/registry.ts` to ensure the tool is correctly registered.

### App alias rejected
- **Symptom**: Lumina says an application alias is unknown instead of executing it.
- **Fix**: Add the alias to `src/config/apps.json`, or use the `terminal` tool for arbitrary shell commands.

### File action rejected
- **Symptom**: A `file` request fails with "Unknown file action".
- **Fix**: Use one of the supported `file` operations (`create_dir`, `delete`, `move`, `copy`, `list`, `read`, `write`, `find`). Shell commands now belong in `terminal`.

### Permission Denied (Terminal)
- **Symptom**: Shell commands fail with "Permission Denied".
- **Fix**: DeskLumina runs as your user. For commands requiring `sudo`, you must use a tool that specifically handles elevated privileges (not yet implemented for safety).

---

## Daemon & Socket Issues

### `EADDRINUSE` / Socket Already Exists
- **Symptom**: The daemon fails to start with "Address already in use".
- **Fix**: A stale socket file might be present. Run `rm ~/.config/desklumina/daemon.sock` and try again.

### Connection Refused (Send Command)
- **Symptom**: `bun run send` fails to connect.
- **Fix**: Verify the daemon is running with `bun run daemon:status`.

---

## TTS & Audio Issues

### No Audio Output
- **Symptom**: The assistant responds in text, but you hear nothing.
- **Fix**: 
  - Check if `Text-to-Speech` is enabled in **Settings** (press `Tab` to expand, then select **Settings**).
  - Ensure your system volume is not muted.
  - Test if you can play audio using `mpv`. If `mpv` is unavailable, Lumina falls back to SoX `play`.

### Distorted / Laggy Audio
- **Symptom**: Voice sounds robotic or cut-off.
- **Fix**: Lower the `TTS Speed` in Settings. High speeds can sometimes cause artifacts with certain voices.

---

## Next Steps

- ⚙️ **[Configuration Guide](04-configuration.md)** — Proper setup helps avoid issues.
- 🏁 **[Back to Introduction](01-introduction.md)**

---

[← Testing](12-testing.md) | [FAQ →](14-faq.md)
