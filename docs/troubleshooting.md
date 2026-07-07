# Troubleshooting & FAQ

## Contents

- [General Questions](#general-questions)
- [AI & API Errors](#ai--api-errors)
- [UI & Rofi Errors](#ui--rofi-errors)
- [Tool Execution Issues](#tool-execution-issues)
- [Configuration Issues](#configuration-issues)
- [Long-Term Memory Issues](#long-term-memory-issues)
- [Text-to-Speech Issues](#text-to-speech-issues)

## General Questions

**Is DeskLumina a full desktop environment?**

No. It runs on top of your existing Linux desktop (GNOME, KDE, Sway) to help you automate tasks via natural language.

**Does it support other operating systems?**

DeskLumina relies on Linux-specific tooling like Rofi, so it is strictly Linux-only.

**Are my files sent to the cloud?**

DeskLumina sends your chat messages to your configured API provider. It does not automatically upload local files. However, if you explicitly instruct it to read a file, the contents of that file become part of the chat context sent to the provider.

## AI & API Errors

### `401 Unauthorized` or "Provider not registered"

Check your `.env` file. Ensure the API key for your targeted provider (e.g. `OPENAI_API_KEY`) is populated and valid. Only providers with a non-empty API key are registered at startup.

### "Model not available" or 404

The model string in `DESKLUMINA_MODEL` may be deprecated or misspelled. Check your provider's documentation for valid model names.

### High latency / slow responses

Try switching to a smaller model or a different provider via `DESKLUMINA_MODEL`. See [Configuration](./configuration.md#environment-env) for how to set fallbacks.

## UI & Rofi Errors

### Rofi does not appear

If `bun run start` returns immediately to the terminal, ensure `rofi` is installed:

```bash
which rofi
```

If the command returns nothing, install Rofi through your system package manager.

### The error panel

If an error panel appears instead of a response, DeskLumina has intercepted a failure. It categorizes the issue into one of the seven error types (network, provider, model, auth, ratelimit, timeout, or unknown).

- Press <kbd>Alt</kbd>+<kbd>R</kbd> to retry the exact prompt.
- Press <kbd>Alt</kbd>+<kbd>C</kbd> to copy the raw error trace to your clipboard for debugging.

### Alt+C does not copy anything

DeskLumina copies to clipboard using `clipcatctl` by default, falling back to `xclip` or `wl-copy` if `clipcatctl` is not installed.

If logs are not copied when you press <kbd>Alt</kbd>+<kbd>C</kbd>, verify the active clipboard tool is running:

```bash
clipcatctl list
```

If the command fails, start the `clipcatd` clipboard manager or switch to an alternative clipboard tool.

## Tool Execution Issues

### "Unknown File Action"

**What it means**: The assistant tried to route a shell command or script through the file-management tool internally, instead of the terminal tool. This is a routing mistake on the assistant's side, not something you did wrong.

**What to do**: Retry your request, or rephrase it slightly (e.g. "run this command" instead of "do this with the file"). If it keeps happening for the same kind of request, [link to bug report / GitHub issue](https://github.com/Rafacuy/desklumina/issues/new)

### Permission denied

**What it means**: The command requires root access (e.g. sudo), but DeskLumina doesn't yet support interactive password prompts for privileged commands. The agent can't relay a password prompt back to you.

**What to do**:

- Set up passwordless sudo for the specific command you need (via visudo, add a NOPASSWD entry) if you want the agent to run it directly.
- Otherwise, run privileged commands yourself in a regular terminal.

_(Interactive sudo prompt support is planned, not yet implemented.)_

## Configuration Issues

### Settings changes not taking effect

**What it means**: You modified `settings.json` but the changes don't appear in the UI or behavior.

**What to do**:

- Ensure you edited the correct file: `~/.config/desklumina/settings.json`
- Check that the JSON is valid (no trailing commas, proper quotes)
- Restart DeskLumina if running in Rofi or terminal mode

### models.json overrides everything

**What it means**: You set up `.env` configuration but DeskLumina ignores it completely.

**What to do**:

- Check if `~/.config/desklumina/models.json` exists. When present, it overrides `.env` entirely.
- Either remove or rename `models.json` to fall back to `.env`-based routing, or move your configuration into `models.json`.

### App aliases not working

**What it means**: You added an alias to `apps.json` but the assistant doesn't recognize it.

**What to do**:

- Verify you edited the correct file: `~/.config/desklumina/src/config/apps.json`
- Check the JSON syntax—ensure no trailing commas and proper quotes
- Try the exact alias name without extra words (e.g., "open myscript" not "open my custom script")
- Aliases apply instantly without restart. If still not working, check the logs for parsing errors.

## Long-Term Memory Issues

### Memory not being stored

**What it means**: You have conversations that should trigger memory extraction, but nothing appears in the database.

**What to do**:

1. Check if LTM is enabled in settings:
   ```bash
   cat ~/.config/desklumina/settings.json | grep ltm
   ```
   Look for `"ltm": true` in the features section.

2. Verify the database path exists and is writable:
   ```bash
   ls -la ~/.local/share/desklumina/ltm.db
   ```

3. Check if an embedding model is configured:
   - If `DESKLUMINA_EMBED_MODEL` is empty and your chat provider doesn't support embeddings, semantic retrieval won't work.
   - Set a dedicated embedding model in settings.json under `ltm.embedModel`.

4. Check the logs for extraction errors or missing provider warnings.

### Memory retrieval returns nothing

**What it means**: The system has stored memories but retrieval returns empty results.

**What to do**:

1. Verify semantic retrieval is enabled:
   ```bash
   cat ~/.config/desklumina/settings.json | grep semanticRetrieval
   ```
   Should show `"enabled": true`.

2. Check the similarity threshold:
   - If `semanticRetrieval.threshold` is set too high (e.g., 0.9), few memories will match.
   - Try lowering it to 0.65 or 0.7 for more lenient matching.

3. Verify episodic memories actually have embeddings:
   - If embeddings failed during extraction, the system falls back to keyword search.
   - Check logs for embedding generation errors.

4. If semantic retrieval is disabled, ensure your query contains keywords that match stored episodic text.

### Database errors or corruption

**What it means**: LTM operations fail with database-related errors.

**What to do**:

1. Check the database file permissions:
   ```bash
   ls -la ~/.local/share/desklumina/ltm.db
   ```

2. If the database is corrupted, you can safely delete it and let DeskLumina recreate it:
   ```bash
   rm ~/.local/share/desklumina/ltm.db
   ```
   This will erase all stored memories, so only do this if you're willing to lose them.

3. Ensure the parent directory exists and is writable:
   ```bash
   mkdir -p ~/.local/share/desklumina
   ```

## Text-to-Speech Issues

### TTS not playing audio

**What it means**: TTS is enabled but you hear no audio output.

**What to do**:

1. Verify TTS is enabled in settings:
   ```bash
   cat ~/.config/desklumina/settings.json | grep tts
   ```
   Look for `"tts": true` in the features section.

2. Check if the Azure TTS voice ID is valid:
   - Invalid voice IDs will fail silently.
   - Try a common voice like `"en-US-AvaNeural"` or `"en-US-JennyNeural"`.

3. Verify your system audio is working:
   ```bash
   paplay /usr/share/sounds/freedesktop/stereo/complete.oga
   ```
   If this fails, the issue is with your audio system, not DeskLumina.

4. Check if the audio backend (PipeWire or PulseAudio) is running:
   ```bash
   pactl info
   ```

### Natural voice enhancements not working

**What it means**: You enabled natural voices but hear no difference from standard TTS.

**What to do**:

1. Verify natural voices are enabled:
   ```bash
   cat ~/.config/desklumina/settings.json | grep naturalVoices
   ```
   Should show `"enabled": true`.

2. Check the threshold setting:
   - If `naturalVoices.thresholdMs` is set too high, enhancements won't trigger for short responses.
   - Try lowering it to 200-300ms for more frequent activation.

3. Verify the assets directory exists:
   - Natural voices need audio assets for filler sounds.
   - Check the `assetsDir` path in settings and ensure the directory contains the required files.

4. Check logs for asset loading errors or missing file warnings.

### TTS voice sounds robotic or wrong language

**What it means**: The voice quality is poor or the language doesn't match your settings.

**What to do**:

1. Verify the voice ID matches your desired language:
   - `en-US-*` voices are for English
   - `id-ID-*` voices are for Indonesian
   - `ja-JP-*` voices are for Japanese

2. Check if language switching worked:
   - When you change the UI language, the TTS voice should update automatically.
   - If it didn't, manually set the voice ID in settings.

3. Try a different voice from the same language family—some voices sound more natural than others.

4. Adjust the speed setting:
   - Speeds below 0.8 or above 1.5 can sound unnatural.
   - Try the default 1.0 for best quality.
