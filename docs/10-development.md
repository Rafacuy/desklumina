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

1.  **Bun**: Ensure you have [Bun](https://bun.sh/) (v1.3.9+) installed.
2.  **Dependencies**: Run `bun install`.
3.  **Dev Mode**: Use `bun run dev` for a persistent terminal chat loop.
4.  **Linting**: Run `bun run lint` to check for TypeScript errors.
5.  **Provider Setup**: Set at least one provider API key in `.env`. Use `bun run start -- provider list` to verify which providers are registere.

---

## Project Architecture

DeskLumina's core is the **`Lumina` orchestrator** at `src/core/lumina.ts`. It follows a deterministic lifecycle:
- **Build System Prompt**: Generates prompt from **Tool Contracts** and **Live Context**.
- **Stream Response**: Managed via `src/ai/orchestrator.ts` through the multi-provider layer.
- **Parse & Dispatch**: `src/core/planner.ts` parses tool calls, which are then dispatched via `src/tools/registry.ts`.
- **AI Orchestration**: `src/ai/orchestrator.ts` resolves the primary model and fallback chain through `ModelRegistry`, routes requests through `ProviderRegistry`, and handles circuit-breaker-based failover.
- **Retry Logic**: Lumina automatically handles retries for retriable tool failures (up to 2 times).

---

## Creating a New Tool

Follow these steps to add a new desktop capability:

### 1. Define the Tool Contract
Add a new `ToolContract` to `src/tools/contracts.ts`. This is the single source of truth for the AI model:

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
Create a new file in `src/tools/`, such as `src/tools/my-tool.ts`. Ensure it returns a `ToolExecutionResult`:

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
Add your tool to the central registry in `src/tools/registry.ts`:

```typescript
import { myTool } from "./my-tool";

export const tools: ToolRegistry = {
  // ...
  my_tool: myTool,
};
```

---

## Adding a New Provider

To add a new AI provider:

### 1. Create the Provider Implementation

Create a directory under `src/ai/provider/<name>/` with a `provider.ts` file. Providers should extend either `OpenAICompatibleAdapter` (for OpenAI-compatible APIs) or `StreamingBaseProvider` (for custom protocols).

```typescript
// src/ai/provider/example/provider.ts
import { StreamingBaseProvider } from "../streaming-base";
// ... implement id, name, validateConfig, capabilities, getEndpoint, getHeaders, getRequestBody, parseChunk
```

### 2. Export from the Provider Index

Add the export to `src/ai/provider/index.ts`:

```typescript
export { ExampleProvider, EXAMPLE_PROVIDER_ID } from "./example";
```

### 3. Register in ProviderRegistry

Add the import and conditional registration to `src/ai/registry/provider-registry.ts`:

```typescript
import { ExampleProvider, EXAMPLE_PROVIDER_ID } from "../provider/example";

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

**Path**: `src/ai/personas.ts`

Personas are defined as a typed `Record<PersonaType, PersonaDefinition>`. Each entry specifies:
- **`id`**: Unique persona identifier (`"default"`, `"tsundere"`, `"catgirl"`, `"deredere"`, `"kuudere"`, `"dandere"`).
- **`translationKey`**: i18n key for UI labels (e.g. `ui.settings.personas.tsundere`).
- **`prompt`**: A compact (1–3 sentence) system prompt fragment. Empty for the default persona.

### Prompt Injection

**File**: `src/ai/prompts.ts` — `buildSystemPrompt()`

The function reads the current persona ID from `settingsManager.get().persona`, resolves it via `getPersona()`, and conditionally prepends the persona prompt to the identity section. Non-default personas produce `identity + "\n\n" + persona.prompt`. The default persona produces `identity` alone with no added text.

### Settings Persistence

**File**: `src/core/settings-manager.ts`

`setPersona(persona: string)` updates the in-memory settings and persists to `settings.json` using the same atomic write pattern (temp file + rename) as all other settings. The `Settings` type stores `persona` as a plain `string`.

### Fallback Handling

`getPersona(id)` in `src/ai/personas.ts` casts the input to `PersonaType` and falls back to `PERSONAS.default` for any unrecognized value. This ensures unknown or corrupted persona IDs never break prompt generation.

### Extending Personas

1. Add the new ID to the `PersonaType` union in `src/ai/personas.ts`.
2. Add a `PersonaDefinition` entry to the `PERSONAS` record with a 1–3 sentence `prompt` (single paragraph, no double newlines).
3. Add i18n keys under `ui.settings.personas.<id>` in each locale file (`src/locales/*.json`).

---

## Adding New i18n Strings

DeskLumina uses a centralized i18n system located in `src/utils/i18n.ts`.

1. Add your new string key to `src/locales/en.json` and `src/locales/id.json`.
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
- **Deterministic Prompts**: Never hardcode tool descriptions in `src/ai/prompts.ts`; always use `ToolContract`.
- **Logging**: Use the built-in `logger` for debugging.
- **Asynchronicity**: Prefer `async/await` over raw Promises.

---

## Next Steps

- 🧪 **[Testing Guide](12-testing.md)**: Deep dive into the test suite.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Integrating tools with background execution.
- 📄 **[CONTRIBUTING.md](../CONTRIBUTING.md)**: How to submit a PR.

---

[← Security](09-security.md) | [Daemon Mode →](11-daemon-mode.md)
