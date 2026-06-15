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
| `DESKLUMINA_MODEL` | **Yes** (or `models.json`) | Primary chat/completion model. |
| `DESKLUMINA_FALLBACKS` | No | Comma-separated list of fallback chat models. Tried in order when the primary fails before producing output. **Supports multi-provider chains** (e.g. `groq:model,openai:model`). |
| `DESKLUMINA_EMBED_MODEL` | No | Dedicated embedding model in `provider:model` format. Used exclusively by the LTM embedding pipeline. See [Embedding Model](#embedding-model). |

### Multi-Provider Fallback Logic

DeskLumina is designed to be provider-agnostic. You can mix and match models from different providers in your fallback chain.

- **Cross-Provider Failover**: If your primary model (e.g., from Groq) fails due to a rate limit or service outage, the system can automatically fail over to a fallback model from a different provider (e.g., OpenAI or Anthropic).
- **Validation**: Fallbacks are only attempted if the corresponding API key for that provider is configured.
- **Order of Execution**: Models are tried strictly in the order they appear in `DESKLUMINA_FALLBACKS` or the `fallbacks` array in `models.json`.

Example multi-provider chain in `.env`:
```bash
DESKLUMINA_FALLBACKS="groq:llama-3.3-70b-versatile,anthropic:claude-haiku-4-5,openai:gpt-4o-mini"
```

### Embedding Model

The chat `model` and the embedding `embedModel` are two distinct concerns. `model` drives `streamChat` requests; `embedModel` drives the `embed` endpoint used by long-term memory (semantic episodic retrieval and extraction). They never share a request path.

| Provider | Embedding endpoint | Recommended `embedModel` |
|----------|--------------------|--------------------------|
| `openai` | `/v1/embeddings` | `text-embedding-3-small`, `text-embedding-3-large` |
| `gemini` | `/v1beta/models/{model}:embedContent` | `gemini-embedding-2`, `gemini-embedding-001` |
| `huggingface` | OpenAI-compatible `/v1/embeddings` | Any feature-extraction model (e.g. `BAAI/bge-large-en-v1.5`) |
| `anthropic` | _not supported_ (Anthropic does not offer first-party embeddings) | N/A |
| `groq` | _not supported_ (Groq does not expose `/embeddings`) | N/A |
| `openrouter` | _not supported_ via the chat-completions path used here | N/A |

Configure the embedding model in one of three places (highest priority wins):

1. **`settings.json`** → `ltm.embedModel` (per-user override; UI-friendly).
2. **`.env`** → `DESKLUMINA_EMBED_MODEL=provider:model`.
3. **`models.json`** → `primary.embedModel` (bare id; combined with `primary.provider`).

The value accepts either `provider:model` (e.g. `gemini:gemini-embedding-001`) or a bare model id (e.g. `text-embedding-3-small`), in which case the provider defaults to the matching chat provider in the same scope.

#### Fallback behavior when `embedModel` is missing

1. If `ltm.embedModel` is empty, try `DESKLUMINA_EMBED_MODEL` / `models.json` `primary.embedModel`.
2. If still unset, reuse `ltm.model` only when its provider truly supports embeddings (preserves pre-`embedModel` configurations that intentionally pointed `ltm.model` at an embedding model).
3. Otherwise, walk the main chat fallback chain (`DESKLUMINA_MODEL` + `DESKLUMINA_FALLBACKS`) and pick the first registered provider whose capabilities declare `embeddingsSupported: true`.
4. If no embedding-capable provider is registered, embedding generation returns `null`. The LTM pipeline degrades gracefully: episodic rows are stored without embeddings, and retrieval falls back to lexical FTS search.

---

## Models Configuration File (models.json)

As an alternative to env-based model configuration, DeskLumina can read `~/.config/desklumina/models.json`. 
This file takes precedence when `DESKLUMINA_MODEL` is not set.

### **EXAMPLES:**
```json
{
  "primary": {
    "provider": "gemini",
    "model": "gemini-3.1-flash-lite",
    "embedModel": "gemini-embedding-2"
  },
  "fallbacks": [
    {
      "provider": "groq",
      "model": "llama-3.3-70b-versatile",
      "reason": "provider-down"
    },
    {
      "provider": "openrouter",
      "model": "deepseek/deepseek-v4-flash:free",
      "reason": "provider-down"
    }
  ],
  "aliases": {
    "fast": {
      "provider": "openai",
      "model": "gpt-5.4-mini",
      "embedModel": "text-embedding-3-small"
    },
    "smart": {
      "provider": "anthropic",
      "model": "claude-opus-4-7"
    }
  }
}
```

- **`primary`**: The default model for all requests. Must include `provider` and `model`; may include `embedModel` for the embedding pipeline.
- **`fallbacks`**: Ordered list of models to try when the primary fails. The `reason` field documents the intended trigger (`rate-limit`, `provider-down`, or `model-not-found`). `embedModel` is accepted but currently only consumed from `primary`.
- **`aliases`**: Named shortcuts that map to a single `{ provider, model, embedModel? }` binding. Useful for switching between profiles (e.g., "fast" vs "smart") without changing the primary config.

Valid provider values: `openai`, `anthropic`, `gemini`, `groq`, `openrouter`, `huggingface`.

---

## Settings JSON (settings.json)

DeskLumina stores user preferences in `~/.config/desklumina/settings.json`.

### Core Settings

```json
{
  "language": "en",
  "persona": "default",
  "features": {
    "tts": false,
    "toolDisplay": true,
    "chatHistory": true,
    "dangerousCommandConfirmation": true,
    "ltm": true
  },
  "tts": {
    "voiceId": "en-US-AvaNeural",
    "speed": 1,
    "naturalVoices": {
      "enabled": true,
      "thresholdMs": 350,
      "maxOverhangMs": 500,
      "volume": 85,
      "assetsDir": "",
      "disfluency": {
        "enabled": false
      },
      "latencyMasking": {
        "enabled": true,
        "deadlineMs": 400
      }
    }
  },
  "ltm": {
    "provider": "",
    "model": "",
    "embedModel": "",
    "episodicCap": 50,
    "tokenBudget": 600,
    "dbPath": "~/.local/share/desklumina/ltm.db",
    "semanticRetrieval": {
      "enabled": true,
      "threshold": 0.65,
      "topK": 5
    }
  }
}
```

- **`language`**: Primary language for the UI and AI. Supported: `"en"`, `"id"`, `"ja"`.
  - Changing the language automatically updates the `tts.voiceId` to a matching natural voice.
  - **Default**: `"en"`
- **`persona`**: Assistant conversational personality. One of `"default"`, `"tsundere"`, `"catgirl"`, `"deredere"`, `"kuudere"`, or `"dandere"`. **Default**: `"default"`. Personas only affect conversational tone, not assistant capabilities.
- **`features.tts`**: Enable or disable text-to-speech output.
- **`features.toolDisplay`**: Show or hide tool execution details in the UI.
- **`features.chatHistory`**: Enable or disable chat history persistence and preview.
- **`features.dangerousCommandConfirmation`**: Require confirmation for critical commands.
- **`features.ltm`**: Master switch for long-term memory extraction/retrieval.
- **`tts.voiceId`**: The Edge TTS voice ID to use.
- **`tts.speed`**: Voice playback speed from 0.5 to 2.0.
- **`tts.naturalVoices.enabled`**: Enable natural voice output with disfluency planning and latency masking.
- **`tts.naturalVoices.volume`**: Natural voice playback volume (0 to 100).
- **`tts.naturalVoices.assetsDir`**: Directory containing natural voice audio assets. Empty uses the built-in default.
- **`tts.naturalVoices.disfluency.enabled`**: Insert natural filler sounds (breath, throat clears, etc.) into TTS output.
- **`tts.naturalVoices.latencyMasking.enabled`**: Mask TTS generation latency by playing filler audio before the real response.
- **`tts.naturalVoices.latencyMasking.deadlineMs`**: Maximum filler duration in milliseconds before the real audio must start.
- **`ltm.provider` / `ltm.model`**: Optional dedicated provider/model for the **chat-side** of LTM (extraction). Empty values fall back to the main provider chain.
- **`ltm.embedModel`**: Optional dedicated **embedding** model. Accepts a bare model id (combined with `ltm.provider`) or a full `provider:model` reference (overrides `ltm.provider` for embeddings only). When empty, falls back to `DESKLUMINA_EMBED_MODEL`, then `models.json` `primary.embedModel`, then the legacy "use `ltm.model` if its provider supports embeddings" path. See [Embedding Model](#embedding-model).
- **`ltm.episodicCap`**: Max episodic entries retained before score-based eviction.
- **`ltm.tokenBudget`**: Max token budget for injected LTM narrative block.
- **`ltm.dbPath`**: SQLite storage file for LTM.
- **`ltm.semanticRetrieval.enabled`**: Enables semantic episodic retrieval (embedding + cosine similarity).
- **`ltm.semanticRetrieval.threshold`**: Similarity threshold for episodic match filtering (default `0.65`).
- **`ltm.semanticRetrieval.topK`**: Maximum episodic matches injected per prompt (default `5`).

### LTM Semantic Retrieval Notes

- Episodic embeddings are persisted in SQLite as JSON text in `memories.embedding`.
- Retrieval computes cosine similarity in memory at read time; no external vector DB or SQLite vector extension is required.
- Legacy episodic rows remain valid after upgrade. Rows without embeddings are skipped for semantic scoring and can still be retrieved through lexical fallback when semantic query embedding is unavailable.
- On migration, DeskLumina safely adds the `embedding` column without deleting existing data.

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
4. Navigate the menu to toggle features, change languages, or select a **Persona**.
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
- **Theme Caching**: DeskLumina caches the resolved theme path to avoid repeated filesystem lookups. The cache is invalidated when the theme file is modified.

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
