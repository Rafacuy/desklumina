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

This file describes ideas that are not yet implemented. Do not treat any item below as available functionality unless it is verified elsewhere in the repository.

---

## Short-Term (v1.x)

- [x] **Remove Settings Manager Placeholder**: Removed the `features.windowContext` placeholder from settings and updated the documentation.
- [x] **Advanced File Management**: Deep file searching is implemented with `locate` for indexed discovery, optional terminal-side `fzf` selection, preview support, and persisted search history.
- [x] **Enhanced Callback System**: Structured callback events now support multi-step responses with initial assistant text, tool display, and final response.
- [x] **Japanese UI Localization**: Now supports full Japanese UI localization for better accessibility to Japanese-speaking users.
- [x] **Multi-Provider API Support**: Implemented a shared `AIProvider` interface with `BaseProvider` and `StreamingBaseProvider` abstractions. Six providers are supported: Groq, OpenAI, Anthropic, Gemini, OpenRouter, and Hugging Face. Providers are registered at startup based on available API keys. The `ProviderRegistry` manages registration and circuit-breaker health tracking, while `ModelRegistry` resolves `provider:model` strings into an ordered fallback chain. OpenAI-compatible providers (Groq, OpenAI, OpenRouter, Hugging Face) share a common adapter; Anthropic and Gemini have dedicated implementations. Automatic fallback on 404/429/5xx errors with circuit-breaker skip for unhealthy providers.
- [ ] **Enhanced Visual Tool Display**: Improve the visual presentation of tool outputs to be more user-friendly.
- [x] **Token Optimization**: Implemented token-manager module with token-based context pruning (4000 token budget), compressed system prompts (~250 tokens, 56% reduction), parallel tool execution, and MAX_TOKENS reduced to 512. Added escapeHtml for XSS prevention across all UI outputs.
- [x] **Multi-Persona System**: Configurable assistant personalities with typed definitions, settings persistence, UI selection, runtime prompt injection, and safe fallback to default.
- [ ] **Local LLM Integration**: Support for Ollama or Llama.cpp for privacy-conscious users.
- [x] **Enhanced TTS**: Natural voice pipeline with disfluency planning, latency masking, and configurable filler sounds. Offline TTS engines are not yet supported.
- [x] **Long-Term Memory (LTM)**: Implemented persistent memory using SQLite3 with three layers (fact, pattern, episodic), FTS5 full-text search with trigram tokenizer, LLM-based extraction from conversation turns, embedding support for vector search, and automatic eviction based on access-count + recency scoring triggered after each extraction when episodic cap is exceeded. Configurable via `settings.ltm` (episodicCap, provider, model, embedModel).
- [x] **Non-Blocking Tool Dispatch**: Fire-and-forget execution for tools whose results are not needed immediately (app launches, notifications, GUI commands). Uses a result store to track background operations, with context injection on subsequent turns. Terminal commands are classified per-call: GUI apps and `&`-suffixed commands run non-blocking; interactive SSH is rejected; package manager install commands are auto-rewritten with non-interactive flags.

---

## Mid-Term (v2.x)

- [ ] **Custom Plugin System**: Allow users to load custom JavaScript or TypeScript plugins without modifying the core.
- [ ] **Workflow Recording**: Record a series of desktop actions and replay them using a natural language command.
- [ ] **Screen Awareness**: Allow the AI to see your screen and describe its contents or interact with visual elements.

---

## Long-Term (Visionary)

- [ ] **Proactive Assistance**: DeskLumina should suggest actions based on your current workflow or calendar events.
- [ ] **Native Mobile App**: Send commands to your desktop via a secure mobile interface.
- [ ] **Full Home Automation**: Integrate with Home Assistant to control your physical environment from your desktop.

---

## Get Involved

We are looking for contributors to help us achieve this vision. If any of these features excite you, check out our **[Contributing Guide](15-contributing.md)**.

---

[← Contributing](15-contributing.md) | [Back to Introduction →](01-introduction.md)
