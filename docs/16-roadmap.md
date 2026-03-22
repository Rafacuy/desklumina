# 16 - Roadmap

Future plans, known limitations, and development direction for DeskLumina.

---

## Current Status

DeskLumina is actively maintained and in stable development. The current version (v1.0.0) provides:

- Natural language desktop control
- BSPWM integration
- Multiple interaction modes
- Security features
- Daemon mode
- Text-to-speech support
- Multi-language support (Indonesian & English)

---

## Planned Features

### Short Term (Next Release)

| Feature | Status | Description |
|---------|--------|-------------|
| Custom themes | Planned | User-definable Rofi themes |
| Chat export | Planned | Export chats to markdown/JSON |
| Keyboard shortcuts | Planned | In-app shortcut customization |

### Medium Term

| Feature | Status | Description |
|---------|--------|-------------|
| Additional AI providers | Planned | OpenAI, Anthropic support |
| Voice input | Planned | Speech-to-text commands |
| Plugin system | Planned | Third-party tool extensions |
| Web UI | Planned | Browser-based interface |
| Configuration GUI | Planned | Settings editor via Rofi |

### Long Term

| Feature | Status | Description |
|---------|--------|-------------|
| Multi-monitor support | Planned | Enhanced monitor awareness |
| Remote control | Planned | Control from other devices |
| Scripting API | Planned | Programmable automation |
| Machine learning | Planned | Learn from user patterns |

---

## Known Limitations

### Platform

- **BSPWM Only** — Currently only supports BSPWM window manager
- **Linux Only** — No macOS or Windows support planned

### AI

- **Single Provider** — Only Groq API is supported currently
- **Rate Limits** — API rate limits may affect heavy usage
- **Latency** — Network-dependent response times

### Features

- **No Voice Input** — TTS output only, no speech recognition
- **No Multi-Session** — One active chat at a time
- **No Sync** — Chat history is local only

---

## Areas for Contribution

### High Priority

- Additional AI provider support
- Test coverage improvements
- Documentation translations
- Bug fixes and stability

### Medium Priority

- Additional tool handlers
- UI/UX improvements
- Performance optimizations
- Example scripts

### Welcome Contributions

- Bug reports and fixes
- Documentation improvements
- Feature suggestions
- Code review

---

## Version History

### v1.0.0 (Current)

- Initial stable release
- BSPWM integration
- Groq API support
- Daemon mode
- Security features
- TTS support

---

## Development Philosophy

### Core Principles

1. **Simplicity** — Keep the codebase clean and maintainable
2. **Security** — Safety features enabled by default
3. **Performance** — Fast, responsive execution
4. **Accuracy** — Documentation matches implementation

### Not Planned

Some features are explicitly not on the roadmap:

- Windows/macOS support
- GUI application (beyond Rofi)
- Built-in AI model (offline)
- Real-time collaboration

---

## How to Influence the Roadmap

### Feature Requests

1. Check existing [GitHub Issues](https://github.com/Rafacuy/desklumina/issues)
2. Open a new issue with the "enhancement" label
3. Describe the use case and benefit
4. Discuss with maintainers

### Contributing

See the [Contributing Guide](15-contributing.md) for:
- Code contributions
- Documentation improvements
- Testing and QA

---

## Stay Updated

- **GitHub Releases:** Watch the repository for release notifications
- **Issues:** Follow issue discussions for development progress
- **Changelog:** Check `CHANGELOG.md` (if available) for updates

---

## Feedback

Your feedback helps shape the roadmap:

- What features do you need most?
- What pain points exist in your workflow?
- What would make DeskLumina more useful?

Share feedback via [GitHub Issues](https://github.com/Rafacuy/desklumina/issues).

---

## Related Documentation

- **[Contributing](15-contributing.md)** — How to contribute
- **[FAQ](14-faq.md)** — Common questions
- **[Development Guide](10-development.md)** — Development setup

---

← Previous: [Contributing](15-contributing.md) | [Back to README](../README.md)