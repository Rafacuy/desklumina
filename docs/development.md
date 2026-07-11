# Development & Contributing

## Contents

- [Environment Setup](#environment-setup)
- [Creating a New Tool](#creating-a-new-tool)
- [Testing](#testing)
- [Adding a New AI Provider](#adding-a-new-ai-provider)
- [Adding a New Language](#adding-a-new-language)
- [Pull Requests](#pull-requests)

## Environment Setup

1. Install [Bun](https://bun.sh/) v1.3.14 or higher.

2. Clone your fork and install dependencies:

   ```bash
   bun install
   ```

3. Set your provider keys in `.env`. See [Configuration](./configuration.md#environment-env) for the required variables.

4. Launch a persistent terminal chat loop for debugging:

   ```bash
   bun run dev
   ```

5. Catch TypeScript errors before committing:

   ```bash
   bun run lint
   ```

   Success looks like: no output and exit code 0.

## Creating a New Tool

1. Add a `ToolContract` to `src/tools/contracts/contracts.ts`.[^1] Define the schema, strict escaping rules, and expected failure modes.

2. Create the implementation in `src/tools/frameworks/your-tool.ts`. It must return a `ToolExecutionResult`.

3. Declare whether your tool is `blocking` or `non-blocking` in `src/tools/registry/modes.ts`.[^2]

4. Register it in `src/tools/registry/registry.ts`[^3] and `src/core/planner.ts`.[^4]

After step 4, the new tool is live in the agent loop without a restart.

[^1]: `src/tools/contracts/contracts.ts`
[^2]: `src/tools/registry/modes.ts`
[^3]: `src/tools/registry/registry.ts`
[^4]: `src/core/planner.ts`

## Testing

DeskLumina uses Bun's built-in test runner.

| Command | Effect |
| --- | --- |
| `bun test` | Run the full test suite |
| `bun test tests/file.test.ts` | Run a single test file |
| `bun test --coverage` | Run with coverage report |

The `tests/architecture/` folder contains critical tests that assert prompt structure. If you add a new tool, these tests ensure its contract is correctly serialized into the final system prompt.

## Adding a New AI Provider

1. Implement an adapter in `src/ai/providers/<name>/provider.ts`. Extend `OpenAICompatibleAdapter` or `StreamingBaseProvider`.[^5]

2. Explicitly declare capabilities (e.g. `embeddingsSupported`).

3. Export it in `src/ai/providers/index.ts`.

4. Register it in `src/ai/registry/provider-registry.ts`.[^6]

5. Add its environment variable to `src/config/env.ts` and update `.env.example`.

6. Update `src/ai/config/models-config.ts`.[^7]

[^5]: `src/ai/providers/streaming-base.ts`
[^6]: `src/ai/registry/provider-registry.ts`
[^7]: `src/ai/config/models-config.ts`

## Adding a New Language

1. Create `src/locales/<code>.json` (copy `en.json`, translate values, keep all keys).
2. Run `bun run scripts/register-locale.ts` and answer: Display Name, TTS voice key(s, comma-separated, optional), Default voice key (required if voices given), Prompt Context (required). It also wires the default voice into `src/ai/tts.ts`.
3. Verify with `bun run lint`.

> [!IMPORTANT]
> Non-Latin scripts (Cyrillic, Arabic, Thai, …) need `TokenManager.estimateTokens` in `src/core/services/token-manager.ts` updated first — it only covers CJK + Latin.

## Pull Requests

- Keep TypeScript strict. Avoid `any`.
- Ensure `bun test` and `bun run lint` both pass before opening a PR.
- All tools must return clear, human-readable summaries so the model can easily interpret them.
