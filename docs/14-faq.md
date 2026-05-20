# 14 - FAQ

Frequently asked questions about DeskLumina.

---

## Table of Contents

- [General Questions](#general-questions)
- [Privacy & Security](#privacy--security)
- [Technical Questions](#technical-questions)
- [Customization](#customization)

---

## General Questions

### Is DeskLumina a full desktop environment?
No. DeskLumina is an assistant layer that runs on top of your existing Linux desktop, such as GNOME, KDE, i3, or Sway. It helps you automate tasks within your current environment.

### Which LLMs does it use?
DeskLumina supports six providers: Groq, OpenAI, Anthropic, Gemini, OpenRouter, and Hugging Face. The active provider and model are determined by `DESKLUMINA_MODEL` (or `models.json`). If fallback models are configured, DeskLumina will try them only when the primary model request fails before any output is produced.

### Does it support other OSs?
Currently, DeskLumina is Linux-only. It relies on Linux-specific tooling such as Rofi and Unix domain sockets.

---

## Privacy & Security

### Is my data sent to the cloud?
DeskLumina sends your chat messages and a static system prompt to the configured AI provider for processing. DeskLumina does not automatically upload local files; if you instruct it to read a file, that file content may become part of the chat context you send.

### Can it run locally?
This repository integrates cloud providers (Groq, OpenAI, Anthropic, Gemini, OpenRouter, Hugging Face). Local LLM support (e.g. Ollama) is not implemented.

---

## Technical Questions

### How does model fallback work?
If the primary model request fails before any output is streamed, DeskLumina tries fallback models. If a model fails after producing output, DeskLumina does not fall back to avoid duplicating partial responses.

### How is the TTS so fast?
DeskLumina uses an Adaptive Chunking strategy. Instead of waiting for the full response, it breaks the incoming AI stream into small, natural sentences and starts generating audio for the first sentence immediately.

### What is the purpose of the Daemon?
The daemon keeps DeskLumina running and exposes a Unix-socket HTTP endpoint at `~/.config/desklumina/daemon.sock`. This is useful for hotkeys and scripts that want to send commands without starting a new process each time.

---

## Customization

### Can I change the Rofi theme?
Yes. Edit `src/ui/themes/lumina.rasi` to change colors, fonts, and layout.

### How do I add my own application aliases?
Modify `src/config/apps.json`. You can map any name to any shell command.

---

## Next Steps

- 🏁 **[Back to Introduction](01-introduction.md)**
- 🚀 **[Quick Start](03-quick-start.md)**

---

[← Troubleshooting](13-troubleshooting.md) | [Contributing →](15-contributing.md)
