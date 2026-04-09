# 16 - Roadmap

The future of DeskLumina. This document outlines our planned features and vision for the project.

---

## Table of Contents

- [Vision](#vision)
- [Short-Term (v1.x)](#short-term-v1x)
- [Mid-Term (v2.x)](#mid-term-v2x)
- [Long-Term (Visionary)](#long-term-visionary)

---

## Vision

This file describes **non-implemented** ideas. Do not treat any item below as available functionality unless it is verified elsewhere in the repository.

---

## Short-Term (v1.x)

- [x] **Remove Settings Manager Placeholder**: Removed the `features.windowContext` placeholder from settings and updated the documentation. (v1.1.2)
- [x] **Advanced File Management**: Deep file searching is implemented with `locate` for indexed discovery, optional terminal-side `fzf` selection, preview support, and persisted search history. (v1.3.0)
- [x] **Enhanced Callback System**: Structuren callback events now support multi-step responses with initial assistant text, tool display, and final response. (v1.3.0)
- [ ] **Download & play songs**: Lumina can search and download specific songs with yt-dlp and play them.
- [ ] **Local LLM Integration**: Support for Ollama or Llama.cpp for privacy-conscious users.
- [ ] **Enhanced TTS**: Add support for more natural voices and offline TTS engines (e.g., Piper).
- [ ] **Long-Term Memory (LTM)**: Implement persistent memory using SQLite3 with robust storage and automatic cleaning. Capabilities include storing schedules, time checks, reminders, and related contextual data.

---

## Mid-Term (v2.x)

- [ ] **Custom Plugin System**: Allow users to load custom JavaScript/TypeScript plugins without modifying the core.
- [ ] **Workflow Recording**: Record a series of desktop actions and replay them using a natural language command.
- [ ] **Screen Awareness**: Allow the AI to "see" your screen and describe its contents or interact with visual elements.

---

## Long-Term (Visionary)

- [ ] **Proactive Assistance**: DeskLumina should suggest actions based on your current workflow or calendar events.
- [ ] **Native Mobile App**: Send commands to your desktop via a secure mobile interface.
- [ ] **Full Home Automation**: Integrate with Home Assistant to control your physical environment from your desktop.

---

## Get Involved

We are always looking for contributors to help us achieve this vision. If any of these features excite you, check out our **[Contributing Guide](15-contributing.md)**.

---

[← Contributing](15-contributing.md) | [Back to Introduction →](01-introduction.md)
