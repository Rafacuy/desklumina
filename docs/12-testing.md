# 12 - Testing

Ensuring the reliability and correctness of DeskLumina's automation features.

---

## Table of Contents

- [Testing Framework](#testing-framework)
- [Test Strategy](#test-strategy)
- [Running Tests](#running-tests)
- [Writing New Tests](#writing-new-tests)
- [CI / Coverage](#ci--coverage)

---

## Testing Framework

DeskLumina uses **[Bun's built-in test runner](https://bun.sh/docs/test/runner)**, which is compatible with Jest and provides fast execution times.

---

## Test Strategy

Our test suite is divided into several categories:

### 1. Unit Tests
Located in `tests/`, these test individual functions and classes in isolation, such as `path.test.ts`, `constants.test.ts`, and `personas.test.ts`.

### 2. Integration Tests
Tests that verify the interaction between multiple modules, such as the `ChatManager` or the `Security` layer.

### 3. Edge-Case Tests
Specifically designed to test TTS chunking and error handling, such as `tts-edge-cases.test.ts`.

### 4. Architecture & Prompt Tests
**Path**: `tests/architecture/`

These critical tests ensure the behavior of the AI by verifying the generated system prompt:
- **Prompt Structure**: Validates the required order (Identity -> Tools -> Rules -> Examples -> Context).
- **Contract Inclusion**: Ensures every tool registered in `src/tools/contracts/contracts.ts` is correctly rendered into the prompt with its schema, types, and escalation rules.
- **Escalation Tree**: Verifies that the 3-stage failure logic is present and correctly phrased.
- **Format Anchors**: Confirms that JSON examples from tool contracts are properly injected.

---

## Running Tests

### Standard Test Run
```bash
bun test
```

### Watch Mode
```bash
bun test --watch
```

### Detailed (Verbose) Run
```bash
bun test --verbose
```

### Coverage Report
```bash
bun test --coverage
```

---

## Writing New Tests

All test files must reside in the `tests/` directory and follow the naming convention: `[module_name].test.ts`.

### Example Unit Test (`tests/path.test.ts`):

```typescript
import { describe, it, expect } from "bun:test";
import { expandTilde } from "../src/utils/system/path";

describe("Path Utils", () => {
  it("should expand ~ to the home directory", () => {
    const home = process.env.HOME;
    expect(expandTilde("~/Documents")).toBe(`${home}/Documents`);
  });
});
```

---

## Next Steps

- 🔧 **[Development Guide](10-development.md)**: Setting up your dev environment.
- 🛡️ **[Security](09-security.md)**: Verifying security rules.
- 🏁 **[Roadmap](16-roadmap.md)**: Future testing goals.

---

[← Daemon Mode](11-daemon-mode.md) | [Troubleshooting →](13-troubleshooting.md)
