# 15 - Contributing

Thank you for your interest in contributing to DeskLumina! We welcome contributions of all types—from bug reports to new tools and documentation improvements.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Reporting Bugs](#reporting-bugs)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)

---

## Code of Conduct

We aim to foster an open and welcoming environment. Please be respectful and constructive in all interactions within our community.

---

## How Can I Contribute?

- **Submit Bug Reports**: Use GitHub issues to report problems.
- **Propose Features**: Open an issue to discuss new ideas.
- **Write Documentation**: Improve our guides and API references.
- **Implement Tools**: Create new desktop automation capabilities.
- **Fix Bugs**: Help us make DeskLumina more stable.

---

## Reporting Bugs

Before reporting a bug, please search existing issues to see if it has already been reported. When creating a new issue, include:
- Your OS and desktop environment (e.g., Arch Linux + i3).
- Your Bun version (`bun --version`).
- A clear description of the problem and steps to reproduce it.
- Relevant log output from `~/.config/desklumina/logs/general.log`.
- If present: `~/.config/desklumina/logs/error.log`.

---

## Development Workflow

1.  **Fork the Repository**: Create your own fork of the DeskLumina repository.
2.  **Create a Branch**: Use a descriptive branch name (e.g., `feature/my-new-tool` or `fix/rofi-theming`).
3.  **Setup Dev Mode**: Run `bun run dev` for an interactive chat loop.
4.  **Implement Changes**: Follow our [Development Guide](10-development.md).
5.  **Test**: Ensure all tests pass with `bun test`.

---

## Pull Request Process

1. Ensure your code follows our **Coding Guidelines**.
2. Update the documentation if you've added or changed features.
3. Submit the Pull Request and wait for a review.
4. Once approved, we will merge your changes!

---

## Coding Guidelines

- **TypeScript**: Use strong typing. Avoid `any` whenever possible.
- **Async/Await**: Prefer modern asynchronous patterns over callbacks.
- **Errors**: Return user-friendly error strings starting with `❌`.
- **Success**: Return success strings starting with `✓`.
- **Testing**: Include unit tests for any new logic or tools.
- **Formatting**: We follow standard TypeScript formatting. Please run `bun run lint` before submitting.

---

## Next Steps

- 🏁 **[Back to Introduction](01-introduction.md)**
- 🚀 **[Quick Start](03-quick-start.md)**

---

[← FAQ](14-faq.md) | [Roadmap →](16-roadmap.md)
