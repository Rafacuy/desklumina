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

---

## Project Architecture

DeskLumina's core is the **`Lumina` orchestrator** at `src/core/lumina.ts`. It follows a deterministic lifecycle:
- **Build System Prompt**: Generates prompt from **Tool Contracts** and **Live Context**.
- **Stream Response**: Managed via `src/ai/groq.ts`.
- **Parse & Dispatch**: `src/core/planner.ts` parses tool calls, which are then dispatched via `src/tools/registry.ts`.
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
