# Configuration

DeskLumina uses three configuration files located in your root config directory.

## Contents

- [Environment (.env)](#environment-env)
- [Advanced Routing (models.json)](#advanced-routing-modelsjson)
- [Settings (settings.json)](#settings-settingsjson)
  - [Core Settings](#core-settings)
  - [Feature Flags](#feature-flags)
  - [UI Customization](#ui-customization)
  - [Web Search Configuration](#web-search-configuration)
  - [Text-to-Speech Settings](#text-to-speech-settings)
  - [Long-Term Memory Settings](#long-term-memory-settings)
- [App Aliases (apps.json)](#app-aliases-appsjson)

## Environment (.env)

The `.env` file holds sensitive credentials and your primary model routing.

At minimum, you must set `DESKLUMINA_MODEL` and provide the corresponding API key. Models use the `provider:model` format.

```env
# API Keys
GROQ_API_KEY=gsk_...
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
# OPENROUTER_API_KEY=...
# HF_API_KEY=...

# Model Routing
DESKLUMINA_MODEL=groq:llama-3.3-70b-versatile
DESKLUMINA_FALLBACKS="openai:gpt-4o-mini,anthropic:claude-haiku-4-5"
```

If your primary provider fails (rate limit hit or a 500 error), DeskLumina automatically walks the comma-separated `DESKLUMINA_FALLBACKS` list and retries the request using the next available provider.

For Long-Term Memory (LTM), you can define a dedicated embedding model by setting `DESKLUMINA_EMBED_MODEL=provider:model` (e.g. `openai:text-embedding-3-small`). If left empty, the system degrades gracefully to lexical search.

## Advanced Routing (models.json)

If `.env` strings are too limiting, you can define model routing in `~/.config/desklumina/models.json`.[^1]

> [!WARNING]
> `models.json` overrides `.env` entirely when present. Remove or rename the file to fall back to `.env`-based routing.

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
    }
  ],
  "aliases": {
    "fast": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  }
}
```

[^1]: `src/ai/config/models-config.ts`

## Settings (settings.json)

User preferences reside in `~/.config/desklumina/settings.json`. You can modify these keys directly, or use the in-app Settings menu (<kbd>Tab</kbd> in the Rofi UI).

### Core Settings

<table>
<tr>
<th>Key</th>
<th>Values</th>
<th>Description</th>
</tr>
<tr>
<td><code>language</code></td>
<td><code>"en"</code>, <code>"id"</code>, <code>"ja"</code></td>
<td>UI display language. Switching this also updates the default TTS voice to match the selected language.</td>
</tr>
<tr>
<td><code>persona</code></td>
<td><code>"default"</code>, <code>"tsundere"</code>, <code>"catgirl"</code>, <code>"deredere"</code>, <code>"kuudere"</code>, <code>"dandere"</code></td>
<td>Assistant conversational tone. Personas inject different behavior patterns into the system prompt without changing underlying capabilities.</td>
</tr>
</table>

### Feature Flags

<table>
<tr>
<th>Key</th>
<th>Values</th>
<th>Description</th>
</tr>
<tr>
<td><code>features.tts</code></td>
<td>boolean</td>
<td>Master toggle for Text-To-Speech output. When enabled, the assistant reads responses aloud.</td>
</tr>
<tr>
<td><code>features.toolDisplay</code></td>
<td>boolean</td>
<td>Show real-time execution logs under responses. This displays which tools the agent calls and their output as the conversation unfolds.</td>
</tr>
<tr>
<td><code>features.chatHistory</code></td>
<td>boolean</td>
<td>Enable the chat history sidebar in the Rofi UI. When disabled, the interface shows only the current conversation.</td>
</tr>
<tr>
<td><code>features.dangerousCommandConfirmation</code></td>
<td>boolean</td>
<td>Enable Rofi confirmation dialog for high-risk commands. See <a href="./security.md#terminal-command-scanning">Security</a> for how commands are classified.</td>
</tr>
<tr>
<td><code>features.ltm</code></td>
<td>boolean</td>
<td>Toggle the SQLite-backed long-term memory system. When disabled, the system neither extracts nor retrieves memories.</td>
</tr>
</table>

### UI Customization

The <code>ui.customization</code> object controls visual aspects of the Rofi interface.

<table>
<tr>
<th>Key</th>
<th>Values</th>
<th>Description</th>
</tr>
<tr>
<td><code>ui.customization.darkMode</code></td>
<td>boolean</td>
<td>Enable the dark color scheme. Defaults to <code>true</code>. You can toggle it in Settings under the Customization section.</td>
</tr>
</table>

### Web Search Configuration

The <code>webSearch</code> object controls how the web search tool behaves by default.

<table>
<tr>
<th>Key</th>
<th>Values</th>
<th>Description</th>
</tr>
<tr>
<td><code>defaultProvider</code></td>
<td><code>"auto"</code>, <code>"serper"</code>, <code>"serpapi"</code>, <code>"searxng"</code>, <code>"tavily"</code></td>
<td>Which search provider to try first. <code>auto</code> picks the first one you have configured with an API key.</td>
</tr>
<tr>
<td><code>fallbackEnabled</code></td>
<td>boolean</td>
<td>Whether to try the next configured provider if the first one fails or hits a rate limit.</td>
</tr>
<tr>
<td><code>defaultLimit</code></td>
<td>number</td>
<td>Maximum number of results to return per search (default 5).</td>
</tr>
<tr>
<td><code>defaultType</code></td>
<td><code>"web"</code>, <code>"news"</code>, <code>"images"</code></td>
<td>Default search type when the user doesn't specify one.</td>
</tr>
<tr>
<td><code>safeSearch</code></td>
<td>boolean</td>
<td>Enable safe search filtering for adult content.</td>
</tr>
<tr>
<td><code>language</code></td>
<td>string</td>
<td>ISO language code for search results (e.g., <code>"en"</code>). Leave empty for auto-detection.</td>
</tr>
<tr>
<td><code>country</code></td>
<td>string</td>
<td>ISO country code for localized results (e.g., <code>"US"</code>). Leave empty for auto-detection.</td>
</tr>
<tr>
<td><code>includeRawContent</code></td>
<td>boolean</td>
<td>Whether to fetch full page content for search results. This adds cost and latency but provides more context.</td>
</tr>
</table>

### Text-to-Speech Settings

The <code>tts</code> object controls voice output behavior.

<table>
<tr>
<th>Key</th>
<th>Values</th>
<th>Description</th>
</tr>
<tr>
<td><code>voiceId</code></td>
<td>string</td>
<td>Azure TTS voice identifier (e.g., <code>"en-US-AvaNeural"</code>).</td>
</tr>
<tr>
<td><code>speed</code></td>
<td>number</td>
<td>Speech playback speed between 0.5 and 2.0 (default 1.0).</td>
</tr>
<tr>
<td><code>naturalVoices.enabled</code></td>
<td>boolean</td>
<td>Enable natural voice enhancements including latency masking and optional disfluency.</td>
</tr>
<tr>
<td><code>naturalVoices.thresholdMs</code></td>
<td>number</td>
<td>Minimum response length in milliseconds before natural voice enhancements activate.</td>
</tr>
<tr>
<td><code>naturalVoices.maxOverhangMs</code></td>
<td>number</td>
<td>Maximum audio buffer overhang in milliseconds for latency masking.</td>
</tr>
<tr>
<td><code>naturalVoices.volume</code></td>
<td>number</td>
<td>Natural voice volume between 0 and 100 (default 100).</td>
</tr>
<tr>
<td><code>naturalVoices.disfluency.enabled</code></td>
<td>boolean</td>
<td>Add human-like filler sounds (um, uh) to speech for a more natural effect.</td>
</tr>
<tr>
<td><code>naturalVoices.latencyMasking.enabled</code></td>
<td>boolean</td>
<td>Mask network latency by playing audio chunks as they arrive rather than waiting for complete sentences.</td>
</tr>
<tr>
<td><code>naturalVoices.latencyMasking.deadlineMs</code></td>
<td>number</td>
<td>Maximum acceptable latency in milliseconds before masking is disabled (default 400).</td>
</tr>
</table>

### Long-Term Memory Settings

The <code>ltm</code> object configures the memory system.

<table>
<tr>
<th>Key</th>
<th>Values</th>
<th>Description</th>
</tr>
<tr>
<td><code>provider</code></td>
<td>string</td>
<td>AI provider for memory extraction and retrieval (e.g., <code>"openai"</code>). If empty, falls back to the main chat provider.</td>
</tr>
<tr>
<td><code>model</code></td>
<td>string</td>
<td>Model identifier for memory operations (e.g., <code>"gpt-4o-mini"</code>). If empty, uses the chat model.</td>
</tr>
<tr>
<td><code>embedModel</code></td>
<td>string</td>
<td>Dedicated embedding model in <code>provider:model</code> format. When empty, the system walks the provider chain to find one that supports embeddings.</td>
</tr>
<tr>
<td><code>episodicCap</code></td>
<td>number</td>
<td>Maximum number of episodic memories to store (default 50). Older, less-accessed entries are evicted when this limit is reached.</td>
</tr>
<tr>
<td><code>tokenBudget</code></td>
<td>number</td>
<td>Maximum tokens allocated for retrieved memories in the system prompt (default 600).</td>
</tr>
<tr>
<td><code>dbPath</code></td>
<td>string</td>
<td>File path for the SQLite database (default <code>"~/.local/share/desklumina/ltm.db"</code>).</td>
</tr>
<tr>
<td><code>semanticRetrieval.enabled</code></td>
<td>boolean</td>
<td>Enable vector-based semantic search for episodic memories. When disabled, falls back to keyword search.</td>
</tr>
<tr>
<td><code>semanticRetrieval.threshold</code></td>
<td>number</td>
<td>Cosine similarity threshold between -1 and 1 (default 0.65). Only memories scoring above this threshold are returned.</td>
</tr>
<tr>
<td><code>semanticRetrieval.topK</code></td>
<td>number</td>
<td>Maximum number of episodic memories to retrieve per request (default 5).</td>
</tr>
</table>

## App Aliases (apps.json)

DeskLumina translates natural language app requests into shell executables using `src/config/apps.json`.[^2]

When you say "open browser", the agent checks `apps.json` and finds the matching entry (e.g. `"browser": "xdg-open https://"`).

To add your own program, append it to the JSON object:

```json
{
  "my-custom-script": "/home/user/bin/my_script.sh --start"
}
```

The agent applies aliases instantly. No restart required.

[^2]: `src/config/apps.json`
