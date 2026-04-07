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

DeskLumina's core is the **`Lumina` orchestrator** (`src/core/lumina.ts`). It follows a simple lifecycle for every user command:
- **Build System Prompt**: Done in `src/ai/prompts.ts`.
- **Stream Response**: Done in `src/ai/groq.ts`.
- **Parse & Dispatch**: Done in `src/core/planner.ts` and `src/tools/registry.ts`.

---

## Creating a New Tool

Follow these steps to add a new desktop capability:

### 1. Create the Tool Logic
Create a new file in `src/tools/`, e.g., `src/tools/my-tool.ts`:

```typescript
export async function myTool(arg: string): Promise<string> {
  // 1. Process the argument
  // 2. Perform the action
  // 3. Return a success (✓) or error (❌) string
  return `✓ Custom action completed: ${arg}`;
}
```

### 2. Register the Tool
Add your tool to the central registry in `src/tools/registry.ts`:

`src/tools/registry.ts` defines a `tools` object; add a new entry to that map and export any helpers you want from `src/tools/index.ts`.

### 3. Update the System Prompt
To let the AI know about your new tool, add its definition to the prompt builder in `src/ai/prompts.ts`:

Update the **TOOLS** section so the model knows the tool name and expected `args` format.

---

## Adding New i18n Strings

1. Add your new string key to `src/locales/en.json` and `src/locales/id.json`.
2. Use the `t()` helper in your code:
   ```typescript
   import { t } from "../utils/i18n";
   console.log(t("Your New Key"));
   ```

---

## Version Management (Developer)

DeskLumina uses **`package.json`** as the **single source of truth** for the app version.

### Show the current version

```bash
bun run start -- --version
```

### Sync the README badge to `package.json`

The README version badge is generated from `package.json` and can be synced automatically:

```bash
bun run version:sync
```

### Set/bump the version (recommended)

This updates `package.json` and the README version badge in one go:

```bash
bun run version:set 1.2.3
```

Accepted formats include prerelease/build metadata (semver), for example:

```bash
bun run version:set 1.2.3-beta.1
bun run version:set 1.2.3+build.5
```

### Implementation notes

- **Runtime version**: `src/utils/version.ts` (`getAppVersion()` reads + caches `package.json` and falls back to `dev`).
- **CLI output**: `src/main.ts` (`--version` prints `Lumina v{version}`).
- **i18n template**: `src/utils/i18n.ts` provides `tf()` for `{var}` interpolation; locales define `Lumina v{version}`.
- **Scripts**:
  - `scripts/sync-version.ts` (used by `bun run version:sync`)
  - `scripts/bump-version.ts` (used by `bun run version:set`)

---

## Testing Changes

We use `bun test` for unit and integration testing.

- **Run all tests**: `bun test`
- **Watch mode**: `bun test --watch`
- **Specific file**: `bun test tests/my-test.test.ts`

When adding a new tool, please add a corresponding test in the `tests/` directory to ensure reliability.

---

## Coding Standards

- **TypeScript First**: Use proper types and interfaces (defined in `src/types/`).
- **Error Handling**: Always return user-friendly error strings starting with `❌`.
- **Logging**: Use the built-in `logger` for internal debugging information.
- **Asynchronicity**: Prefer `async/await` over raw Promises where possible.

---

## Next Steps

- 🧪 **[Testing Guide](12-testing.md)** — Deep dive into the test suite.
- 🤖 **[Daemon Mode](11-daemon-mode.md)** — Integrating tools with background execution.
- 📄 **[CONTRIBUTING.md](../CONTRIBUTING.md)** — How to submit a PR.

---

[← Security](09-security.md) | [Daemon Mode →](11-daemon-mode.md)
