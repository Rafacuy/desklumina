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

### `401 Unauthorized` or Invalid API Key
- **Symptom**: AI responses fail with an authorization error.
- **Fix**: Check your `.env` file. Ensure the API key for your configured provider (e.g. `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) is set correctly and has no leading or trailing spaces.

### Provider not registered
- **Symptom**: Error message says `Provider is not registered: <name>`.
- **Fix**: The provider's API key is missing or empty at startup. Set the corresponding `*_API_KEY` in `.env` and restart DeskLumina. Only providers with a non-empty API key are registered.

### Slow Responses or High Latency
- **Symptom**: The assistant takes several seconds to respond.
- **Fix**: 
  - Check your internet connection.
  - Try switching to a different provider by changing `DESKLUMINA_MODEL` to use another provider's model.

---

## UI & Rofi Issues

### Rofi Does Not Appear
- **Symptom**: Running `bun run start` returns to the terminal immediately.
- **Fix**: 
  - Ensure `rofi` is installed: `which rofi`.
  - Check for syntax errors in your `.rasi` theme file at `src/ui/themes/lumina.rasi`.

### Rofi Theme Looks Broken
- **Symptom**: Colors are missing or the layout is shifted.
- **Fix**: The included `.rasi` theme expects a modern version of Rofi. If you are on an older distribution, you may need to simplify the theme or use the default one.

### Error Panel Shows Instead of Response
- **Symptom**: An error panel appears with a warning icon and suggestion text.
- **Fix**: The error panel classifies the failure into one of seven categories:
  - **Could not connect** (network): Check your internet connection.
  - **Provider unavailable** (provider): Try switching to a different provider.
  - **Model not available** (model): The selected model may have been removed.
  - **Authentication failed** (auth): Check your API key in the config.
  - **Rate limit reached** (ratelimit): Wait a moment before retrying.
  - **Request timed out** (timeout): The provider took too long to respond.
  - **Something went wrong** (unknown): Copy the error and check the logs.
  
  Use `Alt+R` to retry the request or `Alt+C` to copy the full error string for debugging.

---

## Tool Execution Issues

### "Tool Not Found"
- **Symptom**: AI says it is executing a tool, but nothing happens.
- **Fix**: Check `src/tools/registry/registry.ts` to ensure the tool is correctly registered.

### App alias rejected
- **Symptom**: Lumina says an application alias is unknown instead of executing it.
- **Fix**: Add the alias to `src/config/apps.json`, or use the `terminal` tool for arbitrary shell commands.

### File action rejected
- **Symptom**: A `file` request fails with "Unknown file action".
- **Fix**: Use one of the supported `file` operations like `create_dir`, `delete`, or `move`. Shell commands now belong in `terminal`.

### Permission Denied (Terminal)
- **Symptom**: Shell commands fail with "Permission Denied".
- **Fix**: DeskLumina runs as your user. For commands requiring `sudo`, you must use a tool that handles elevated privileges.

---

## Daemon & Socket Issues

### `EADDRINUSE` or Socket Already Exists
- **Symptom**: The daemon fails to start with "Address already in use".
- **Fix**: A stale socket file might be present. Run `rm $XDG_RUNTIME_DIR/desklumina.sock` (or `rm ~/.config/desklumina/desklumina.sock`) and try again.

### Connection Refused (Send Command)
- **Symptom**: `bun run send` fails to connect.
- **Fix**: Verify the daemon is running with `bun run daemon:status`.

---

## TTS & Audio Issues

### No Audio Output
- **Symptom**: The assistant responds in text, but you hear nothing.
- **Fix**: 
  - Check if `Text-to-Speech` is enabled in **Settings**.
  - Ensure your system volume is not muted.
  - Test if you can play audio using `mpv`. If `mpv` is unavailable, Lumina falls back to SoX `play`.

### Distorted or Laggy Audio
- **Symptom**: Voice sounds robotic or cut-off.
- **Fix**: Lower the `TTS Speed` in Settings. High speeds can cause artifacts with certain voices.

### Response Panel Does Not Dismiss After TTS
- **Symptom**: The response panel remains visible after TTS finishes playing.
- **Fix**: The panel should auto-dismiss when playback completes. If it does not, check that the TTS session finished without errors. You can also check the daemon logs for TTS-related warnings. Use `isTTSPlaying()` internally to track whether audio is still active.

---

## Next Steps

- ⚙️ **[Configuration Guide](04-configuration.md)**: Proper setup helps avoid issues.
- 🏁 **[Back to Introduction](01-introduction.md)**

---

[← Testing](12-testing.md) | [FAQ →](14-faq.md)
