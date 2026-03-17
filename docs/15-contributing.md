# 15 - Contributing Guide

Thank you for your interest in contributing to DeskLumina! This guide outlines the process and guidelines for contributing.

---

## Getting Started

### Prerequisites

- Bun v1.3.9+
- BSPWM window manager
- Groq API key
- Git

### Setup

```bash
# Fork the repository on GitHub
# Clone your fork to your BSPWM agent config directory
git clone https://github.com/YOUR_USERNAME/desklumina.git ~/.config/bspwm/agent
cd ~/.config/bspwm/agent

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Add your Groq API key
nano .env
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/add-new-tool`
- `fix/daemon-restart`
- `docs/api-reference`

### 2. Make Changes

Follow the [Code Conventions](#code-conventions) below.

### 3. Run Tests

```bash
# Type check
bun run lint

# Run tests
bun test

# Run tests with coverage
bun test --coverage
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat(tools): add new window action"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Code Conventions

### Naming

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `chatManager` |
| Functions | camelCase | `buildSystemPrompt()` |
| Classes | PascalCase | `Lumina` |
| Types | PascalCase | `AIMessage` |
| Constants | UPPER_SNAKE_CASE | `COMMAND_TIMEOUT` |
| Files | kebab-case | `chat-manager.ts` |

### Imports

Group imports by type:

```typescript
// External packages
import { exec } from "bun:shell";

// Internal modules
import { logger } from "../logger";

// Relative imports
import { formatResult } from "./utils";
```

### Error Handling

Always use proper error handling:

```typescript
try {
  const result = await execute(command);
  return result.stdout;
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("module", `Failed: ${err.message}`, err);
  return `❌ Error: ${err.message}`;
}
```

### Internationalization

Never hardcode user-facing strings:

```typescript
import { t } from "./utils";

// ❌ Bad
console.log("File deleted");

// ✅ Good
console.log(t("File deleted"));
```

---

## Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no code change) |
| `refactor` | Code refactoring |
| `test` | Adding/updating tests |
| `chore` | Maintenance tasks |

### Examples

```
feat(tools): add wait_and_move action to bspwm tool

- Implement window waiting logic
- Add timeout handling
- Update tool registry

Closes #42
```

```
fix(daemon): prevent multiple daemon instances

Add PID file locking to prevent duplicate processes.

Fixes #15
```

---

## Testing

### Requirements

- All new features must have tests
- All tests must pass
- Code coverage should not decrease

### Running Tests

```bash
bun test
```

### Writing Tests

```typescript
import { describe, test, expect, beforeEach } from "bun:test";

describe("MyModule", () => {
  beforeEach(() => {
    // Setup
  });

  test("does something correctly", () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

---

## Documentation

### When to Update

Update documentation when:
- Adding new features
- Changing existing behavior
- Fixing documented bugs
- Improving clarity

### Documentation Structure

- Update relevant `.md` files in `docs/`
- Keep examples up to date
- Add navigation links
- Follow existing format

---

## Pull Request Guidelines

### Before Submitting

- [ ] Type checking passes (`bun run lint`)
- [ ] Tests pass (`bun test`)
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Description

Include:
1. **What** — Description of changes
2. **Why** — Motivation for changes
3. **How** — Implementation details
4. **Testing** — How you tested

### Review Process

1. Automated checks run
2. Maintainers review code
3. Feedback is addressed
4. PR is approved and merged

---

## Reporting Issues

### Bug Reports

Include:
- **Description** — What happened
- **Steps to reproduce** — How to trigger it
- **Expected behavior** — What should happen
- **Actual behavior** — What actually happened
- **Environment** — OS, Bun version, etc.
- **Logs** — Relevant error messages

### Feature Requests

Include:
- **Problem** — What problem does this solve?
- **Solution** — Proposed implementation
- **Alternatives** — Other approaches considered

---

## Code of Conduct

### Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the project

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Publishing others' private information
- Any unprofessional conduct

---

## Getting Help

- **Documentation:** Browse the `docs/` directory
- **Issues:** Check existing issues on GitHub
- **Discussions:** Use GitHub Discussions for questions

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Related Documentation

- **[Development Guide](10-development.md)** — Development workflow
- **[Testing Guide](12-testing.md)** — Testing documentation
- **[API Reference](08-api-reference.md)** — API documentation

---

← Previous: [FAQ](14-faq.md) | Next: [Roadmap](16-roadmap.md) →