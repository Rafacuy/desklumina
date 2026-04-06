# 04 - Configuration

Fine-tune DeskLumina's behavior to match your workflow. This guide covers environment variables, settings JSON, and UI customization.

---

## Table of Contents

- [Environment Variables (.env)](#environment-variables-env)
- [Settings JSON (settings.json)](#settings-json-settingsjson)
- [Interactive Settings (Rofi)](#interactive-settings-rofi)
- [UI & Themes](#ui--themes)
- [Application Aliases (apps.json)](#application-aliases-appsjson)

---

## Environment Variables (.env)

The `.env` file in the project root is used for sensitive credentials and core service configuration.

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | **Yes** | Your API key from [Groq Console](https://console.groq.com/). |
| `MODEL_NAME` | **Yes** | Primary Groq model name (read by `src/config/env.ts`). |
| `FALLBACK_MODELS` | No | Comma-separated model list used when the primary model is unavailable. If unset, defaults are used (see `.env.example`). |

---

## Settings JSON (settings.json)

DeskLumina stores user preferences in `~/.config/desklumina/settings.json`. You can edit this file directly or use the interactive settings menu.

### Core Settings

```json
{
  "language": "id",
  "features": {
    "tts": false,
    "toolDisplay": true,
    "chatHistory": true,
    "windowContext": true,
    "dangerousCommandConfirmation": true
  },
  "tts": {
    "voiceId": "id-ID-GadisNeural",
    "speed": 1.0
  }
}
```

- **`language`**: Primary language for the UI and AI. Supported: `"en"`, `"id"`.
- **`features.tts`**: Enable/disable text-to-speech output.
- **`features.toolDisplay`**: Show/hide tool execution details in the UI.
- **`features.windowContext`**: Placeholder feature flag. Currently toggleable in settings but has no functional effect.
- **`features.dangerousCommandConfirmation`**: Require confirmation for critical commands.
- **`tts.voiceId`**: The Edge TTS voice ID to use.
- **`tts.speed`**: Voice playback speed (0.5 to 2.0).

---

## Interactive Settings (Rofi)

You can adjust most settings without leaving the Rofi interface.

1. Launch DeskLumina: `bun run start`.
2. Press `Tab` to expand the menu.
3. Select **Settings**.
4. Navigate the menu to toggle features or change languages.
5. Select **Save & Exit** to apply changes.

---

## UI & Themes

DeskLumina uses **Rofi** for its graphical interface. You can customize the appearance by modifying the CSS-like `.rasi` files.

- **Main Theme**: `src/ui/themes/lumina.rasi`
- **Colors & Styles**: Edit the variables at the top of the `.rasi` file to change background colors, fonts, and borders.

---

## Application Aliases (apps.json)

The `src/config/apps.json` file contains a mapping of natural names (aliases) to system commands.

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

- 🔧 **[Tools Reference](07-tools-reference.md)** — Learn about all built-in tools.
- 🧠 **[Architecture](05-architecture.md)** — Understand the internal design.
- 🤖 **[Daemon Mode](11-daemon-mode.md)** — Optimize performance with background persistence.

---

[← Quick Start](03-quick-start.md) | [Architecture →](05-architecture.md)
