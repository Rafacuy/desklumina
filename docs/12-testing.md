# 12 - Testing Guide

DeskLumina uses Bun's native test runner for testing. All tests are in the `tests/` directory.

---

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/security.test.ts

# Watch mode
bun test --watch

# With coverage
bun test --coverage

# Verbose output
bun test --verbose

# Run tests matching pattern
bun test --test-name-pattern "security"
```

---

## Test Files

| File | Description |
|------|-------------|
| `chat-manager.test.ts` | Chat creation, message management |
| `constants.test.ts` | Command timeouts, API endpoints, models |
| `env.test.ts` | Environment variable validation |
| `logger.test.ts` | Logger methods |
| `path.test.ts` | Path utilities (expandTilde, normalizePath) |
| `security.test.ts` | Dangerous command detection |
| `tools.test.ts` | Tool handlers (fileOp, bspwm, media, clipboard, notify) |
| `daemon.test.ts` | Daemon mode (isolated) |

---

## Writing Tests

### Basic Test Structure

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { ChatManager } from "../src/core/chat-manager";

describe("ChatManager", () => {
  let chatManager: ChatManager;

  beforeEach(() => {
    chatManager = new ChatManager();
  });

  test("creates new chat", () => {
    const chat = chatManager.createChat("Test message");
    expect(chat).toBeDefined();
    expect(chat.id).toBeDefined();
  });

  test("adds messages correctly", () => {
    chatManager.createChat("Test");
    chatManager.addMessage("user", "Hello");
    const chat = chatManager.getCurrentChat();
    expect(chat?.messages).toHaveLength(1);
  });
});
```

---

## Common Matchers

### Equality

```typescript
expect(value).toBe(expected);           // Strict equality
expect(value).toEqual(expected);        // Deep equality
```

### Truthiness

```typescript
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();
expect(value).toBeUndefined();
```

### Numbers

```typescript
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(5);
expect(value).toBeGreaterThanOrEqual(5);
expect(value).toBeLessThanOrEqual(5);
```

### Strings

```typescript
expect(string).toContain("substring");
expect(string).toHaveLength(10);
expect(string).toMatch(/pattern/);
```

### Arrays

```typescript
expect(array).toContain(item);
expect(array).toHaveLength(3);
```

### Objects

```typescript
expect(object).toHaveProperty("key");
expect(object).toHaveProperty("key", value);
```

### Functions

```typescript
expect(fn).toThrow();
expect(fn).toThrow(Error);
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(2);
```

---

## Mocking

### Creating Mocks

```typescript
import { mock } from "bun:test";

const mockFn = mock((x: number) => x * 2);

const result = mockFn(5);
expect(result).toBe(10);
expect(mockFn).toHaveBeenCalledWith(5);
```

### Mocking Modules

```typescript
import { mockModule } from "bun:test";

mockModule("../src/ai/groq", () => ({
  streamGroq: mock(function* () {
    yield "Hello";
    yield " World";
  }),
}));
```

---

## Test Categories

### Unit Tests

Test individual functions in isolation.

```typescript
// tests/path.test.ts
describe("expandTilde", () => {
  test("expands ~ to home directory", () => {
    const result = expandTilde("~/Documents");
    expect(result).toBe("/home/user/Documents");
  });

  test("returns path unchanged if no tilde", () => {
    const result = expandTilde("/etc/config");
    expect(result).toBe("/etc/config");
  });
});
```

### Integration Tests

Test module interactions.

```typescript
// tests/tools.test.ts
describe("bspwm tool", () => {
  test("focuses workspace", async () => {
    const result = await bspwm("focus_workspace 3");
    expect(result).toContain("workspace 3");
  });
});
```

### Security Tests

Test security-critical functionality.

```typescript
// tests/security.test.ts
describe("dangerous command detection", () => {
  test("detects rm -rf as critical", () => {
    const analysis = analyzeCommand("rm -rf /home");
    expect(analysis.isDangerous).toBe(true);
    expect(analysis.highestSeverity).toBe("critical");
  });

  test("allows safe commands", () => {
    const analysis = analyzeCommand("ls -la");
    expect(analysis.isDangerous).toBe(false);
  });
});
```

---

## Best Practices

### 1. Descriptive Test Names

```typescript
// ❌ Bad
test("test1", () => { });

// ✅ Good
test("expandTilde expands ~ to home directory", () => { });
```

### 2. One Assertion Per Test

Each test should verify a single behavior.

```typescript
// ❌ Bad
test("tests everything", () => {
  expect(a).toBe(1);
  expect(b).toBe(2);
  expect(c).toBe(3);
});

// ✅ Good
test("returns correct value for a", () => {
  expect(a).toBe(1);
});
```

### 3. Use beforeEach for Setup

```typescript
describe("MyModule", () => {
  let instance: MyModule;

  beforeEach(() => {
    instance = new MyModule();
  });

  test("does something", () => {
    // instance is fresh for each test
  });
});
```

### 4. Test Edge Cases

```typescript
describe("formatFileSize", () => {
  test("handles zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  test("handles negative", () => {
    expect(formatFileSize(-1)).toBe("0 B");
  });

  test("handles very large values", () => {
    expect(formatFileSize(Number.MAX_SAFE_INTEGER)).toBeDefined();
  });
});
```

### 5. Independent Tests

Tests should not depend on each other.

```typescript
// ❌ Bad - test order matters
let count = 0;
test("increments", () => { count++; });
test("checks count", () => { expect(count).toBe(1); });

// ✅ Good - each test is independent
test("increments", () => {
  const count = 0;
  expect(count + 1).toBe(1);
});
```

---

## Pre-commit Checklist

- [ ] All tests pass (`bun test`)
- [ ] New features have tests
- [ ] Edge cases covered
- [ ] Type checking passes (`bun run lint`)

---

## CI/CD Integration

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
bun test
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Jest API Reference](https://jestjs.io/docs/api)

---

## Related Documentation

- **[Development Guide](10-development.md)** — Development workflow
- **[Contributing](15-contributing.md)** — Contribution guidelines

---

← Previous: [Daemon Mode](11-daemon-mode.md) | Next: [Troubleshooting](13-troubleshooting.md) →