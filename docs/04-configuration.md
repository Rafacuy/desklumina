# 04 - Configuration

DeskLumina offers several configuration options to customize behavior. This guide covers all available settings and how to modify them.

---

## Configuration Files

| File | Purpose |
|------|---------|
| `.env` | API credentials and model selection |
| `settings.json` | Feature flags and TTS settings |
| `src/config/apps.json` | Application aliases |

---

## Environment Variables

The `.env` file contains sensitive configuration that should not be committed to version control.

### Location

```
~/.config/bspwm/agent/.env
```

### Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Your Groq API key |
| `MODEL_NAME` | Yes | Primary AI model |
| `FALLBACK_MODELS` | No | Comma-separated fallback models |

### Example

```bash
# .env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MODEL_NAME=openai/gpt-oss-120b
FALLBACK_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,openai/gpt-oss-20b
```

### Available Models

| Model | Speed | Quality | Best For |
|-------|-------|---------|----------|
| `openai/gpt-oss-120b` | Medium | High | Complex operations |
| `llama-3.3-70b-versatile` | Fast | Good | General use |
| `llama-3.1-8b-instant` | Very Fast | Basic | Simple commands |
| `openai/gpt-oss-20b` | Fast | Good | Fallback |

---

## Feature Settings

The `settings.json` file controls feature toggles.

### Location

```
~/.config/bspwm/agent/settings.json
```

### Structure

```json
{
  "features": {
    "tts": false,
    "toolDisplay": true,
    "chatHistory": true,
    "windowContext": true,
    "dangerousCommandConfirmation": true
  },
  "tts": {
    "voiceId": "id-ID-GadisNeural",
    "speed": 1
  }
}
```

### Feature Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `tts` | boolean | `false` | Enable text-to-speech responses |
| `toolDisplay` | boolean | `true` | Show tool execution in UI |
| `chatHistory` | boolean | `true` | Save conversations to disk |
| `windowContext` | boolean | `true` | Include active window info in context |
| `dangerousCommandConfirmation` | boolean | `true` | Require confirmation for dangerous commands |

### TTS Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `voiceId` | string | `id-ID-GadisNeural` | Voice identifier |
| `speed` | number | `1` | Speech speed multiplier |

### Available Voices

| Voice ID | Language | Gender |
|----------|----------|--------|
| `id-ID-GadisNeural` | Indonesian | Female |
| `id-ID-ArdiNeural` | Indonesian | Male |
| `en-US-JennyNeural` | English (US) | Female |
| `en-US-GuyNeural` | English (US) | Male |

### Speed Options

Valid speed values: `0.5`, `0.75`, `1.0`, `1.25`, `1.5`, `2.0`

---

## Application Aliases

Application aliases are defined in `src/config/apps.json`.

### Structure

```json
{
  "terminal": {
    "aliases": ["terminal", "term"],
    "command": "alacritty"
  },
  "browser": {
    "aliases": ["browser", "web"],
    "command": "xdg-open https://"
  }
}
```

### Adding Custom Aliases

Edit `src/config/apps.json` to add new application shortcuts:

```json
{
  "myapp": {
    "aliases": ["myapp", "ma"],
    "command": "my-app-command"
  }
}
```

### Default Aliases

| Alias | Application |
|-------|-------------|
| `terminal`, `term` | Alacritty |
| `kitty` | Kitty Terminal |
| `browser` | Default Browser |
| `chrome` | Google Chrome |
| `files`, `thunar` | Thunar File Manager |
| `yazi` | Yazi TUI |
| `editor`, `geany` | Geany |
| `neovim`, `nvim` | Neovim |
| `telegram`, `tg` | Telegram |
| `whatsapp`, `wa` | WhatsApp Web |
| `youtube`, `yt` | YouTube |
| `github` | GitHub |
| `spotify` | Spotify Web |
| `music`, `ncmpcpp` | NCMPCPP |
| `btop` | BTop Monitor |
| `htop` | HTop Monitor |
| `bluetooth` | Bluetooth Manager |

---

## Daemon Configuration

The daemon mode uses a Unix socket for communication.

### Default Settings

| Setting | Value |
|---------|-------|
| Socket Path | `~/.config/bspwm/agent/daemon.sock` |
| Protocol | HTTP over Unix Domain Socket |
| Timeout | 30 seconds |

### Custom Socket Path

The socket path is derived from the application directory. To change it, modify `src/daemon/daemon.ts`:

```typescript
const SOCKET_PATH = path.join(process.cwd(), "daemon.sock");
```

---

## Logging Configuration

Logs are stored in the application directory.

### Log Files

| File | Content |
|------|---------|
| `logs/general.log` | All log messages |
| `logs/error.log` | Error messages only |

### Log Levels

- `info` — General information
- `warn` — Warnings
- `error` — Errors
- `success` — Successful operations

### Viewing Logs

```bash
# View all logs
tail -f ~/.config/bspwm/agent/logs/general.log

# View errors only
tail -f ~/.config/bspwm/agent/logs/error.log
```

---

## Security Configuration

### Protected Paths

Operations on these paths require confirmation:

```
/, /bin, /boot, /dev, /etc, /lib, /root, /sys, /usr, /var
```

To modify protected paths, edit `src/security/dangerous-commands.ts`.

### Command Timeout

Default timeout: 30 seconds

To change, edit `src/constants/commands.ts`:

```typescript
export const COMMAND_TIMEOUT = 30000; // milliseconds
```

### Dangerous Command Patterns

Commands matching these patterns trigger security warnings:

- `rm -rf` — Recursive deletion
- `sudo` — Privilege escalation
- `shutdown`, `reboot`, `poweroff` — System power
- `mkfs`, `fdisk` — Disk operations
- `dd` — Low-level copy

See [Security Guide](09-security.md) for complete details.

---

## Language Settings

DeskLumina supports localization via the dictionary system.

### Dictionary Location

```
src/locales/dictionary.json
```

### Changing Language

Edit `src/locales/dictionary.json` to translate strings:

```json
{
  "Hello": "Halo",
  "Goodbye": "Selamat tinggal"
}
```

---

## Example Configurations

### Minimal Configuration

```json
// settings.json
{
  "features": {
    "tts": false,
    "toolDisplay": true,
    "chatHistory": true,
    "windowContext": true,
    "dangerousCommandConfirmation": true
  }
}
```

### Full Features Enabled

```json
// settings.json
{
  "features": {
    "tts": true,
    "toolDisplay": true,
    "chatHistory": true,
    "windowContext": true,
    "dangerousCommandConfirmation": true
  },
  "tts": {
    "voiceId": "id-ID-GadisNeural",
    "speed": 1
  }
}
```

---

## Troubleshooting

### Settings Not Applied

Ensure `settings.json` is valid JSON:

```bash
# Validate JSON
cat settings.json | jq .
```

### API Key Issues

```bash
# Verify key is set
echo $GROQ_API_KEY

# Test API
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
```

---

## Next Steps

- **[Architecture](05-architecture.md)** — Understand the system design
- **[Usage Guide](06-usage-guide.md)** — Learn all interaction modes
- **[Security](09-security.md)** — Security features in detail

---

← Previous: [Quick Start](03-quick-start.md) | Next: [Architecture](05-architecture.md) →