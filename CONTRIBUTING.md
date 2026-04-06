# Contributing to DeskLumina

Thank you for your interest in contributing to DeskLumina! We welcome all kinds of contributions, from small bug fixes to major new features.

---

## Getting Started

1.  **Read the Docs**: Familiarize yourself with our **[Documentation](docs/)**.
2.  **Fork & Clone**: Fork the repository and clone it to your local machine.
3.  **Install Bun**: Ensure you have [Bun](https://bun.sh/) installed.
4.  **Install Deps**: Run `bun install`.
5.  **Setup .env**: Copy `.env.example` to `.env` and set `GROQ_API_KEY` and `MODEL_NAME`.

---

## Preferred Workflow

1.  **Open an Issue**: For non-trivial changes, please open an issue first to discuss your proposal.
2.  **Create a Branch**: `git checkout -b feature/your-feature-name`.
3.  **Implement**: Follow our coding standards.
4.  **Test**: Run `bun test` to ensure no regressions.
5.  **Submit PR**: Submit a Pull Request and provide a clear description of your changes.

---

## Coding Standards

- **TypeScript**: We use strict TypeScript. Avoid `any`.
- **Formatting**: Run `bun run lint` before submitting.
- **Testing**: Add unit tests for new logic in the `tests/` directory.
- **Tone**: Keep communication professional and constructive.

---

## Documentation

If you modify features, please update the corresponding `.md` file in the `docs/` directory. Documentation is a first-class citizen in DeskLumina!

---

## Need Help?

Open a GitHub issue or pull request with details and reproduction steps.

---

*Happy hacking!*
