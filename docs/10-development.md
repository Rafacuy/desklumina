# 10 - Development

A guide for developers looking to extend DeskLumina or contribute to the core project.

---

## Table of Contents

- [Environment Setup](#environment-setup)
- [Project Architecture](#project-architecture)
- [Creating a New Tool](#creating-a-new-tool)
- [Adding New i18n Strings](#adding-new-i18n-strings)
- [Testing Changes](#testing-changes)
- [Coding Standards](#coding-standards)

---

## Environment Setup

1.  **Bun**: Ensure you have [Bun](https://bun.sh/) (v1.3.14+) installed.
2.  **Dependencies**: Run `bun install`.
3.  **Dev Mode**: Use `bun run dev` for a persistent terminal chat loop.
4.  **Linting**: Run `bun run lint` to check for TypeScript errors.
5.  **Provider Setup**: Set at least one provider API key in `.env`. Use `bun run start -- provider list` to verify which providers are registered.

---

## Creating a New Tool

Follow these steps to add a new desktop capability:

### 1. Define the Tool Contract
Add a new `ToolContract` to `src/tools/contracts/contracts.ts`. This is the single source of truth for the AI model:

```typescript
{
  name: "my_tool",
  description: "Perform a custom action.",
  schema: "my_tool <required_arg> [optional_arg]",
  types: { required_arg: "string", optional_arg: "string" },
  requiredArgs: ["required_arg"],
  optionalArgs: ["optional_arg"],
  validFormats: ["my_tool something"],
  invalidFormats: ["my_tool 'something'"],
  escapingRules: "None",
  quotingRules: "Quotes forbidden",
  output: {
    success: "✓ Done",
    failure: "❌ Failed",
    empty: "N/A"
  },
  failure: {
    retriable: ["Timeout"],
    nonRetriable: ["Invalid arg"],
    retryLimit: 1,
    permissionBehavior: "N/A",
    malformedInputBehavior: "Returns error code 2"
  },
  formatAnchors: ['{"tool":"my_tool","args":"something"}']
}
```

### 2. Implement the Tool Logic
Create a new file in `src/tools/frameworks/`, such as `src/tools/frameworks/my-tool.ts`. Ensure it returns a `ToolExecutionResult`:

```typescript
import { ToolExecutionResult } from "../types";

export async function myTool(arg: string): Promise<ToolExecutionResult> {
  // 1. Process/Normalize the argument
  // 2. Perform the action
  // 3. Return a structured result
  return {
    tool: "my_tool",
    result: "Action completed successfully",
    success: true,
    normalizedArg: arg.trim()
  };
}
```

### 3. Register the Tool
Add your tool to the central registry in `src/tools/registry/registry.ts`:

```typescript
import { myTool } from "../frameworks/my-tool";
import { registerTool } from "./registry";

registerTool("my_tool", myTool);
```

---

## Configuring Dispatch Modes

Tools can be configured to run in blocking or non-blocking mode via `src/tools/registry/modes.ts`.

### Default Modes

Most tools are blocking by default. Tools that are inherently fire-and-forget (like `app` and `notify`) should be declared as non-blocking:

```typescript
const TOOL_MODES: Record<string, ToolDispatchConfig> = {
  terminal:  { mode: "blocking" },     // hybrid; classified per-command
  file:      { mode: "blocking" },
  math:      { mode: "blocking" },
  clipboard: { mode: "blocking" },
  music:     { mode: "blocking" },
  media:     { mode: "blocking" },
  app:       { mode: "non-blocking" },
  notify:    { mode: "non-blocking" },
};
```

### Hybrid Tools (Terminal)

The `terminal` tool is declared as `blocking` in `TOOL_MODES` but uses runtime classification via `classifyCommand()` (`src/tools/frameworks/terminal-classify.ts`). The `getDispatchMode()` function checks the command argument and returns `non-blocking` for:
- Known GUI applications (defined in `GUI_APPS` set)
- Commands ending with `&`

### Adding a Tool with Non-Blocking Mode

1. Add the tool to `TOOL_MODES` in `src/tools/registry/modes.ts`:
   ```typescript
   my_tool: { mode: "non-blocking" },
   ```
2. The executor will automatically fire-and-forget, register the operation in the result store, and return a synthetic result.
3. The real result will be injected into context on the next agent turn.

---

## Terminal Command Classifier

**Path**: `src/tools/frameworks/terminal-classify.ts`

The terminal classifier determines how each command is executed. It returns one of three modes:

| Mode | Description |
|------|-------------|
| `blocking` | Command runs with stdout/stderr capture and timeout |
| `non-blocking` | Command is spawned detached (GUI apps, `&`-suffixed) |
| `rejected` | Command is refused (empty, interactive ssh) |

### Extending GUI Apps

To add a new GUI application to the non-blocking list, add it to the `GUI_APPS` set:

```typescript
const GUI_APPS: ReadonlySet<string> = new Set([
  // ... existing apps ...
  "my-gui-app",
]);
```

### Interactive Installer Rewrites

The classifier automatically rewrites package manager install commands to be non-interactive. To add support for a new package manager, extend `rewriteInteractiveInstaller()`:

```typescript
if (/\bmy-pm\s+install\b/.test(command) && !/(^|\s)-y\b/.test(command)) {
  return command.replace(/\b(my-pm)(\s+)(install)\b/, "$1$2$3 -y");
}
```

---

## Adding a New Provider

### 1. Create the Provider Implementation

Create a directory under `src/ai/providers/<name>/` with a `provider.ts` file. Providers should extend either `OpenAICompatibleAdapter` (for OpenAI-compatible APIs) or `StreamingBaseProvider` (for custom protocols).

```typescript
// src/ai/providers/example/provider.ts
import { StreamingBaseProvider } from "../streaming-base";
// ... implement id, name, validateConfig, capabilities, getEndpoint, getHeaders, getRequestBody, parseChunk
```

### 2. Export from the Provider Index

Add the export to `src/ai/providers/index.ts`:

```typescript
export { ExampleProvider, EXAMPLE_PROVIDER_ID } from "./example";
```

### 3. Register in ProviderRegistry

Add the import and conditional registration to `src/ai/registry/provider-registry.ts`:

```typescript
import { ExampleProvider, EXAMPLE_PROVIDER_ID } from "../providers/example";

// In initialize():
if (env.EXAMPLE_API_KEY) {
  this.register(new ExampleProvider(env.EXAMPLE_API_KEY));
}
```

### 4. Add Env Var and Endpoint

Add the API key to `src/config/env.ts` and the endpoint constant to `src/constants/models.ts`. Add the provider ID to the `PROVIDERS` list in `src/ai/config/models-config.ts`.

---

## Multi-Persona System

DeskLumina supports configurable assistant personas that alter conversational tone without affecting functionality.

### Persona Definitions

**Path**: `src/ai/runtime/personas.ts`

Personas are defined as a typed `Record<PersonaType, PersonaDefinition>`. Each entry specifies:
- **`id`**: Unique persona identifier (`"default"`, `"tsundere"`, `"catgirl"`, `"deredere"`, `"kuudere"`, `"dandere"`).
- **`translationKey`**: i18n key for UI labels (e.g. `ui.settings.personas.tsundere`).
- **`prompt`**: A compact (1–3 sentence) system prompt fragment. Empty for the default persona.

### Prompt Injection

**File**: `src/ai/runtime/prompts.ts` (`buildSystemPrompt()`)

The function reads the current persona ID from `settingsManager.get().persona`, resolves it via `getPersona()`, and conditionally prepends the persona prompt to the identity section. Non-default personas produce `identity + "\n\n" + persona.prompt`. The default persona produces `identity` alone with no added text.

### Settings Persistence

**File**: `src/core/services/settings-manager.ts`

`setPersona(persona: string)` updates the in-memory settings and persists to `settings.json` using the same atomic write pattern (temp file + rename) as all other settings. The `Settings` type stores `persona` as a plain `string`.

### Fallback Handling

`getPersona(id)` in `src/ai/runtime/personas.ts` casts the input to `PersonaType` and falls back to `PERSONAS.default` for any unrecognized value. This ensures unknown or corrupted persona IDs never break prompt generation.

### Extending Personas

1. Add the new ID to the `PersonaType` union in `src/ai/runtime/personas.ts`.
2. Add a `PersonaDefinition` entry to the `PERSONAS` record with a 1–3 sentence `prompt` (single paragraph, no double newlines).
3. Add i18n keys under `ui.settings.personas.<id>` in each locale file (`src/locales/*.json`).

---

## Settings UI Architecture

Understanding this structure is necessary when adding new settings or panels.

### Module Structure

| Module | Purpose |
|--------|---------|
| `src/ui/settings.ts` | Main orchestration, panel loop, row building |
| `src/ui/settings/rows.ts` | Row type definitions (`SettingsRow`, `NavRow`, `ToggleRow`, `SectionRow`) and render functions |
| `src/ui/settings/tokens.ts` | Color token resolution (light/dark via `gsettings`) |
| `src/ui/settings/footer.ts` | Contextual footer hint builder (`buildFooterHint`) |
| `src/ui/settings/section.ts` | Section header renderer (`sectionHeader`) |
| `src/constants/settings-keys.ts` | Typed `SettingKey` union for toggle row keys |

### Row Types

Three row types compose the settings panel:

1. **SectionRow** (`type: "section"`): Non-selectable divider with label.
2. **NavRow** (`type: "nav"`): Navigates to a sub-panel or value picker. Includes `icon`, `label`, optional `value`, `panel` identifier, optional `key` (SettingKey), and `depth` (0, 1, or 2).
3. **ToggleRow** (`type: "toggle"`): Boolean toggle with pill badge. Includes `icon`, `label`, `key` (SettingKey), `value` (boolean), and `depth`.

Maximum nesting depth is 2 (L0 parent, L1 child, L2 grandchild). Sub-rows are conditionally rendered based on parent toggle state.

### Adding a New Toggle Setting

1. Add the key to `SettingKey` in `src/constants/settings-keys.ts`.
2. Add the toggle row to `buildSettingsRows()` in `src/ui/settings.ts` with the correct `key`.
3. Add a case to `applyToggle()` to call the appropriate `settingsManager` method.
4. Add the `settingsManager` method in `src/core/services/settings-manager.ts` if it doesn't exist.
5. Add i18n strings for the label in all locale files.

### Adding a New Sub-Panel

1. Add a new `panel` identifier string to the parent `NavRow`.
2. Add a case in `handleNavPanel()` to call your new panel function.
3. Implement the panel function (e.g., `promptMyNewPanel()`) following the pattern of `promptPersonaPanel()` or `promptTTSVoicePanel()`.
4. For simple value pickers, use `rofiMenu` with `format: "i"` and a list of options.
5. For nested settings panels with toggles, reuse `buildSettingsRows` pattern with `renderRow` and `promptSettings` recursion.

### Color Tokens and Theming

The panel resolves the GTK color scheme at runtime via `resolveColorScheme()` (checks `org.gnome.desktop.interface color-scheme`, falls back to theme name). Tokens are defined in `LIGHT_TOKENS` and `DARK_TOKENS` in `tokens.ts`. The selected-row accent border is defined in `src/ui/themes/settings.rasi`.

### Footer Hints

Contextual hints use i18n keys:
- `settings.hint.open`: for navigation rows
- `settings.hint.toggle`: for toggle rows
- `settings.hint.close`: for all rows

---

## Chat History View Architecture

The Chat History View replaces the old "Tab to expand" menu with a dedicated, fixed-height Rofi window. Understanding this architecture is helpful when modifying or extending history-related UI.

### Module Structure

| Module | Purpose |
|--------|---------|
| `src/ui/history.ts` | Main History View (`rofiHistoryView`), index-based selection via `-format i`, Pango-styled rows |
| `src/ui/conversation-view.ts` | Message viewer (`rofiConversationView`) with Copy (Alt+C) and Expand (Tab) actions |
| `src/ui/themes/history.rasi` | Rofi theme: fixed-height `listview` (10 lines), `scrollbar` widget, `markup-rows: true` |
| `src/core/services/chat-manager.ts` | `getHistoryPangoLines()` / `getHistoryPangoLinesWithMapping()` -- generates Pango markup lines from stored chat messages |

### Key Design 

**Index-based selection**: The view uses `-format i` to return the selected row index rather than row text. This avoids fragility against Pango markup in row content. A helper function (`resolveHistorySelection` in `history.ts`) maps the integer result to menu actions (Select Chat, Settings, Exit) or conversation row indices.

**Fixed-height listview**: The `history.rasi` theme sets `fixed-height: true` on the listview with `lines: 10`. The window reserves exactly that many rows; the listview scrolls internally once the conversation exceeds the limit. This guarantees the menu rows (Select Chat, Settings, Exit) and the entry bar never scroll off-screen.

**Pango markup in rows**: Because the listview uses `markup-rows: true`, the `@` color aliases defined in `lumina.rasi` do not apply to row content. Row colors are set with explicit Pango `<span foreground="...">` attributes, using the same hex values as the alias palette (`#7060CA` for accent, `#2E2A26` for text-primary, `#A79F96` for muted, `#E4A7A1` for error).

**Conversation Viewer**: When a history row is selected, `history.ts` resolves the nearest non-tool message index and opens `rofiConversationView`. The viewer renders the message in a styled panel with a Copy button (`Alt+C`, mapped to `kb-custom-2`) and a Tab key to expand truncated content via `rofiExpandedResponse`.

### Adding or Modifying History Rows

1. Pango strings for history rows are built in `chat-manager.ts` (`getHistoryPangoLinesWithMapping`). Each row uses escaped content via `escapeHtml` to prevent XSS.
2. Tool messages are rendered as muted, italic lines prefixed with a gear icon (⚙) and the tool label.
3. User and assistant messages use bold labels with `common.you` / `common.lumina` prefixes.
4. `HISTORY_LINE_MAX_CHARS` (110) controls truncation width; excess characters are replaced with `...`.

### Testing

- `tests/chat-manager.test.ts` includes a test for `getHistoryPangoLinesWithMapping`.

---

## Adding New i18n Strings

DeskLumina uses a centralized i18n system located in `src/utils/localization/i18n.ts`.

1. Add your new string key to `src/locales/en.json`, `src/locales/id.json`, and `src/locales/ja.json`.
   ```json
   {
     "error": {
       "not_found": "Path not found: {path}"
     }
   }
   ```
2. Use the `t()` helper for static strings or `tf()` for parameterized strings.

---

## Version Management

DeskLumina uses `package.json` as the version source.
- `bun run version:sync`: Syncs README badge to `package.json`.
- `bun run version:set 1.2.3`: Updates version in `package.json` and README.

---

## Testing Changes

We use `bun test` for unit and integration testing.

- **Run all tests**: `bun test`
- **Specific file**: `bun test tests/my-test.test.ts`

When adding a new tool, please add a corresponding test in the `tests/` directory and ensure the `ToolContract` is covered by architecture tests.

---

## Coding Standards

- **TypeScript First**: Use proper types from `src/types/`.
- **Structured Results**: Tool handlers MUST return `ToolExecutionResult` with appropriate `success` and `status` fields.
- **Deterministic Prompts**: Never hardcode tool descriptions in `src/ai/runtime/prompts.ts`; always use `ToolContract`.
- **Logging**: Use the built-in `logger` for debugging.
- **Asynchronicity**: Prefer `async/await` over raw Promises.

---

## Next Steps

- 🧪 **[Testing Guide](12-testing.md)**: Deep dive into the test suite.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Integrating tools with background execution.
- 📄 **[CONTRIBUTING.md](../CONTRIBUTING.md)**: How to submit a PR.

---

[← Security](09-security.md) | [Daemon Mode →](11-daemon-mode.md)
