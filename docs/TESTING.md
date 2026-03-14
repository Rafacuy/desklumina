# 🧪 Testing Guide

DeskLumina uses **Bun's native test runner** for testing. All tests are in the `tests/` directory.

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

## Writing Tests

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

  test("adds messages correctly", async () => {
    chatManager.createChat("Test");
    chatManager.addMessage("Hello", "user");
    const chat = chatManager.getCurrentChat();
    expect(chat?.messages).toHaveLength(1);
  });
});
```

## Common Matchers

```typescript
// Equality
expect(value).toBe(expected);
expect(value).toEqual(expected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(5);

// Strings
expect(string).toContain("substring");
expect(string).toHaveLength(10);

// Arrays
expect(array).toContain(item);
expect(array).toHaveLength(3);

// Objects
expect(object).toHaveProperty("key");
expect(object).toHaveProperty("key", value);

// Functions
expect(fn).toThrow();
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
```

## Test Categories

**Unit Tests** - Test individual functions in isolation (`path.test.ts`, `logger.test.ts`, `constants.test.ts`)

**Integration Tests** - Test module interactions (`tools.test.ts`, `chat-manager.test.ts`)

**Security Tests** - Test security-critical functionality (`security.test.ts`)

## Best Practices

1. **Descriptive test names** - `test("expandTilde expands ~ to home directory")`
2. **One assertion per test** - Each test verifies a single behavior
3. **Use beforeEach for setup** - Reset state before each test
4. **Test edge cases** - Empty input, negative numbers, large values
5. **Independent tests** - Tests should not depend on each other

## Pre-commit Checklist

- [ ] All tests pass (`bun test`)
- [ ] New features have tests
- [ ] Edge cases covered
- [ ] Type checking passes (`bun run lint`)

## CI/CD Integration

Pre-commit hook (`.git/hooks/pre-commit`):

```bash
#!/bin/bash
bun test
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

## Resources

- [Bun Test Docs](https://bun.sh/docs/cli/test)
- [Jest API](https://jestjs.io/docs/api)
