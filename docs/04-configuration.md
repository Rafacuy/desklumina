# 04 - Configuration

Fine-tune DeskLumina's behavior to match your workflow. This guide covers environment variables, settings JSON, and UI customization.

---

## Table of Contents

- [Environment Variables (.env)](#environment-variables-env)
- [Settings JSON (settings.json)](#settings-json-settingsjson)
- [Interactive Settings (Rofi)](#interactive-settings-rofi)
- [Provider CLI](#provider-cli)
- [UI & Themes](#ui--themes)
- [Application Aliases (apps.json)](#application-aliases-appsjson)

---

## Environment Variables (.env)

The `.env` file in the project root stores sensitive credentials and core service configuration.

### Provider API Keys

At least one of the following keys must be set. DeskLumina registers only the providers whose API key is present at startup.

| Variable | Provider | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Groq | API key from [Groq Console](https://console.groq.com/). |
| `OPENAI_API_KEY` | OpenAI | API key from [OpenAI Platform](https://platform.openai.com/). |
| `ANTHROPIC_API_KEY` | Anthropic | API key from [Anthropic Console](https://console.anthropic.com/). |
| `GEMINI_API_KEY` | Google Gemini | API key from [Google AI Studio](https://aistudio.google.com/). |
| `OPENROUTER_API_KEY` | OpenRouter | API key from [OpenRouter](https://openrouter.ai/). |
| `HF_API_KEY` | Hugging Face | API key from [Hugging Face](https://huggingface.co/). |

### Model Configuration

Models are specified in `provider:model` format (e.g. `groq:llama-3.3-70b-versatile`). The provider portion must match one of the registered providers above.

| Variable | Required | Description |
|----------|----------|-------------|
| `DESKLUMINA_MODEL` | **Yes** (or `models.json`) | Primary model to use. |
| `DESKLUMINA_FALLBACKS` | No | Comma-separated list of fallback models. Tried in order when the primary fails before producing output. **Supports multi-provider chains** (e.g. `groq:model,openai:model`). |

### Multi-Provider Fallback Logic

DeskLumina is designed to be provider-agnostic. You can mix and match models from different providers in your fallback chain.

- **Cross-Provider Failover**: If your primary model (e.g., from Groq) fails due to a rate limit or service outage, the system can automatically fail over to a fallback model from a different provider (e.g., OpenAI or Anthropic).
- **Validation**: Fallbacks are only attempted if the corresponding API key for that provider is configured.
- **Order of Execution**: Models are tried strictly in the order they appear in `DESKLUMINA_FALLBACKS` or the `fallbacks` array in `models.json`.

Example multi-provider chain in `.env`:
```bash
DESKLUMINA_FALLBACKS="groq:llama-3.3-70b-versatile,anthropic:claude-haiku-4-5,openai:gpt-4o-mini"
```

---

## Models Configuration File (models.json)

As an alternative to env-based model configuration, DeskLumina can read `~/.config/desklumina/models.json`. 
This file takes precedence when `DESKLUMINA_MODEL` is not set.

### **EXAMPLES:**
```json
{
  "primary": {
    "provider": "gemini",
    "model": "gemini-3.1-flash-lite-preview"
  },
  "fallbacks": [
    {
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "reason": "provider-down"
    },
    {
      "provider": "openrouter"
      "model": "deepseek/deepseek-v4-flash:free"
      "reason": "provider-down"
    }
  ],
  "aliases": {
    "fast": [
      "openai:gpt-5.4-mini",
      "groq:llama-3.3-70b-versatile"
    ],
    "smart": [
      "anthropic:claude-opus-4-7",
      "openai:gpt-5.5"
    ]
  }
}
```

- **`primary`**: The default model for all requests. Must include `provider` and `model`.
- **`fallbacks`**: Ordered list of models to try when the primary fails. The `reason` field documents the intended trigger (`rate-limit`, `provider-down`, or `model-not-found`).
- **`aliases`**: Named model groups that expand into an ordered chain. Useful for switching between "fast" and "smart" profiles without changing the primary config.

Valid provider values: `openai`, `anthropic`, `gemini`, `groq`, `openrouter`, `huggingface`.

---

## Settings JSON (settings.json)

DeskLumina stores user preferences in `~/.config/desklumina/settings.json`.

### Core Settings

```json
{
  "language": "en",
  "features": {
    "tts": false,
    "toolDisplay": true,
    "chatHistory": true,
    "dangerousCommandConfirmation": true
  },
  "tts": {
    "voiceId": "en-US-AvaNeural",
    "speed": 1
  }
}
```

- **`language`**: Primary language for the UI and AI. Supported: `"en"`, `"id"`, `"ja"`.
  - Changing the language automatically updates the `tts.voiceId` to a matching natural voice.
  - **Default**: `"en"`
- **`features.tts`**: Enable or disable text-to-speech output.
- **`features.toolDisplay`**: Show or hide tool execution details in the UI.
- **`features.dangerousCommandConfirmation`**: Require confirmation for critical commands.
- **`tts.voiceId`**: The Edge TTS voice ID to use.
- **`tts.speed`**: Voice playback speed from 0.5 to 2.0.

### Storage & Retention Limits

To ensure high performance and low memory usage, DeskLumina enforces the following limits:

- **Chat Retention**: DeskLumina keeps only the **100 most recent chats** in `~/.config/desklumina/chats/`. Oldest chat files are automatically deleted during new chat creation or saving.
- **Memory Optimization**: Metadata for the chat list is extracted efficiently using regex. Full chat history is only loaded into memory when a specific chat is active, preventing latency even with many stored conversations.

---

## Interactive Settings (Rofi)

You can adjust most settings within the Rofi interface.

1. Launch DeskLumina: `bun run start`.
2. Press `Tab` to expand the menu.
3. Select **Settings**.
4. Navigate the menu to toggle features or change languages.
5. Select **Save & Exit** to apply changes.

---

## Provider CLI

DeskLumina includes a `provider` subcommand for managing providers from the terminal:

| Command | Description |
|---------|-------------|
| `bun run start -- provider list` | List all registered providers (those with an API key set). |
| `bun run start -- provider current` | Show the currently configured primary model and its resolved provider. |

---

## UI & Themes

DeskLumina uses **Rofi** for its graphical interface. You can customize the appearance by modifying the CSS-like `.rasi` files.

- **Main Theme**: `src/ui/themes/lumina.rasi`
- **Colors & Styles**: Edit the variables at the top of the `.rasi` file to change background colors, fonts, and borders.

---

## Application Aliases (apps.json)

The `src/config/apps.json` file contains a mapping of natural names to system commands.

```json
{
  "browser": "xdg-open https://",
  "telegram": "telegram-desktop",
  "term": "alacritty",
  "neovim": "alacritty -e nvim"
}
```

### Adding a Custom Alias
1. Open `src/config/apps.json`.
2. Add your alias and the corresponding command:
   ```json
   "my-app": "command --arguments"
   ```
3. Save the file. DeskLumina will immediately recognize the new alias.

---

## Next Steps

- 🔧 **[Tools Reference](07-tools-reference.md)**: Learn about all built-in tools.
- 🧠 **[Architecture](05-architecture.md)**: Understand the internal design.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Optimize performance with background persistence.

---

[← Quick Start](03-quick-start.md) | [Architecture →](05-architecture.md)
Architecture →](05-architecture.md)
