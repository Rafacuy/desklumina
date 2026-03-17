# 14 - FAQ

Frequently asked questions about DeskLumina.

---

## General

### What is DeskLumina?

DeskLumina is an AI-powered desktop automation agent for BSPWM that lets you control your Linux desktop using natural language commands.

### Is DeskLumina free to use?

Yes, DeskLumina is open source and free to use. However, you need a Groq API key which has a free tier with generous limits.

### Which window managers are supported?

DeskLumina is designed specifically for BSPWM. It may work with other tiling window managers but is not officially supported.

### What languages does DeskLumina understand?

DeskLumina processes natural language in any language supported by the AI model. The interface and responses can be localized via the dictionary system.

---

## Setup

### Do I need a specific Linux distribution?

No, but DeskLumina is optimized for the [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) configuration. It works best on Arch Linux or similar distributions.

### How do I get a Groq API key?

1. Visit [console.groq.com](https://console.groq.com)
2. Create an account or sign in
3. Navigate to API Keys
4. Create a new key
5. Add it to your `.env` file

### Can I use a different AI provider?

Currently, DeskLumina only supports Groq API. Support for other providers (OpenAI, Anthropic, etc.) may be added in the future.

### What are the system requirements?

- Bun v1.3.9+
- BSPWM window manager
- ~100MB RAM (including daemon)
- Internet connection for AI API

---

## Usage

### How do I start DeskLumina?

```bash
# Interactive mode (Rofi UI)
bun start

# Terminal chat mode
bun run dev

# Daemon mode
bun run daemon
```

### Can I use DeskLumina with keyboard shortcuts?

Yes, you can integrate with sxhkd. See the [Daemon Mode guide](11-daemon-mode.md#sxhkd-integration) for details.

### How do I create custom application aliases?

Edit `src/config/apps.json` to add new aliases:

```json
{
  "myapp": {
    "aliases": ["myapp", "ma"],
    "command": "my-app-command"
  }
}
```

### Can I disable the security confirmation?

Yes, but it's not recommended. Edit `settings.json`:

```json
{
  "features": {
    "dangerousCommandConfirmation": false
  }
}
```

---

## Daemon Mode

### What is daemon mode?

Daemon mode runs DeskLumina as a background service, providing instant command execution without startup overhead.

### How is daemon mode faster?

The daemon keeps the AI context in memory, eliminating cold starts. Response times drop from ~2-3 seconds to <200ms.

### How do I check if the daemon is running?

```bash
bun run daemon:status
```

### Can the daemon start automatically?

Yes, use the systemd service. See the [Daemon Mode guide](11-daemon-mode.md#systemd-service) for setup instructions.

### Why is my daemon slow?

Possible causes:
- Multiple daemon instances running
- Network latency
- API rate limiting
- System resources

Try:
```bash
pkill -f "main.ts.*daemon"
bun run daemon
```

---

## Features

### Does DeskLumina support text-to-speech?

Yes, TTS can be enabled in `settings.json`:

```json
{
  "features": {
    "tts": true
  },
  "tts": {
    "voiceId": "id-ID-GadisNeural",
    "speed": 1
  }
}
```

### How does context awareness work?

When enabled, DeskLumina captures information about your active window (class, title, workspace) and includes it in the AI context. This allows commands like "move this window to workspace 3".

### Where is chat history stored?

Chats are stored in:
```
~/.config/bspwm/agent/chats/
```

Each chat is a separate JSON file with messages, tool calls, and metadata.

### Can I export my chat history?

Yes, chat files are plain JSON. You can copy, backup, or process them with any JSON tool.

---

## Troubleshooting

### Why does nothing happen when I run a command?

Check:
1. Is your Groq API key valid?
2. Is your internet connection working?
3. Are there errors in the logs?

```bash
tail -f ~/.config/bspwm/agent/logs/general.log
```

### Why is my command blocked?

Commands may be blocked if they match dangerous patterns or target protected paths. Check [Security documentation](09-security.md) for details.

### Why can't I delete a file?

File deletion is blocked for:
- Protected system paths (`/etc`, `/usr`, etc.)
- Paths requiring confirmation

Make sure you confirm the operation when prompted.

### Why is the AI not understanding my command?

Try:
- Being more specific
- Using simpler language
- Breaking complex commands into steps
- Checking if the action is supported

---

## Security

### Is it safe to run AI-generated commands?

DeskLumina includes multiple security layers:
- Dangerous command detection
- Path protection
- User confirmation for risky operations
- Timeout protection

Always review commands before confirming.

### Where is my API key stored?

Your API key is stored in `.env`, which is excluded from git via `.gitignore`. Never commit this file.

### Can DeskLumina execute sudo commands?

Sudo commands are detected as "critical" severity and require explicit confirmation. Use with caution.

---

## Development

### How do I contribute?

See the [Contributing Guide](15-contributing.md) for details on:
- Code conventions
- Testing requirements
- Pull request process

### How do I add a new tool?

1. Create a handler in `src/tools/`
2. Export from `src/tools/index.ts`
3. Register in `src/tools/registry.ts`
4. Update system prompt in `src/ai/prompts.ts`

See [Tools Reference](07-tools-reference.md#creating-custom-tools) for details.

### How do I run tests?

```bash
bun test
```

---

## Performance

### How much memory does DeskLumina use?

- **Normal mode:** ~50-80MB per command
- **Daemon mode:** ~45MB persistent + ~2MB per request

### Why is the first command slow?

The first command includes:
- Runtime initialization
- Model loading
- API connection establishment

Daemon mode eliminates this overhead.

### How can I make DeskLumina faster?

1. Use daemon mode
2. Use a faster model (e.g., `llama-3.1-8b-instant`)
3. Keep commands simple and specific

---

## More Questions?

If your question isn't answered here:

1. Check the [Troubleshooting guide](13-troubleshooting.md)
2. Browse the [Documentation](01-introduction.md)
3. Open an issue on [GitHub](https://github.com/Rafacuy/desklumina/issues)

---

← Previous: [Troubleshooting](13-troubleshooting.md) | Next: [Contributing](15-contributing.md) →