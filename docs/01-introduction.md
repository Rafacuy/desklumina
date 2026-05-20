# 01 - Introduction

DeskLumina is an intelligent, high-performance desktop automation agent designed for Linux environments. It enables natural language control of your system, making complex operations as simple as describing your intent.

---

## Table of Contents

- [What is DeskLumina?](#what-is-desklumina)
- [Core Philosophy](#core-philosophy)
- [Example Interactions](#example-interactions)
- [Key Features](#key-features)
- [Why DeskLumina?](#why-desklumina)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)

---

## What is DeskLumina?

DeskLumina translates human intent into system execution. Built for native Linux integration, it leverages the speed of **Bun** and a **multi-provider AI layer** (Groq, OpenAI, Anthropic, Gemini, OpenRouter, Hugging Face) to provide an assistant that feels like a natural extension of your desktop.

## Core Philosophy

### Natural Language First
Rather than memorizing keyboard shortcuts, CLI arguments, or configuration syntax, you simply tell DeskLumina what you want to accomplish in plain language.

### Performance & Responsiveness
DeskLumina streams model output from the configured AI provider and can optionally run text-to-speech for the assistant response.

### Secure by Design
The system analyzes every command for safety. Destructive or sensitive operations require explicit user confirmation through a Rofi-based dialog, ensuring you remain in full control.

---

## Example Interactions

> **User:** "open telegram"
> **DeskLumina:** (executes tool call `{"tool": "app", "args": "telegram"}`)

> **User:** "create a folder on Desktop"
> **DeskLumina:** (executes tool call `{"tool": "file", "args": "create_dir ~/Desktop/NewFolder"}`)

> **User:** "play music"
> **DeskLumina:** (executes tool call `{"tool": "music", "args": "{\"action\": \"play\"}"}`)

---

## Key Features

- **🪟 Rofi Integration**: A lightweight, keyboard-friendly UI that fits perfectly into tiling window managers like i3, bspwm, or sway.
- **🔊 Low-Latency TTS**: Near-instant voice responses using the `AdaptiveChunker` and Edge TTS.
- **🤖 Smart Daemon**: A persistent background service that eliminates startup overhead.
- **🛡️ Security Layer**: Automatic detection of dangerous commands with interactive confirmation.
- **🔧 Extensible Tools**: A modular system for controlling applications, files, media, and more.
- **🌐 Multilingual**: Native support for English, Indonesian, and Japanese.

---

## Why DeskLumina?

Modern desktops are powerful but often complex. DeskLumina was created for users who:
- Want to automate repetitive tasks without writing scripts.
- Prefer natural language over complex keyboard shortcuts.
- Need a lightweight, customizable assistant that does not bloat the system.

---

## How It Works

1.  **Input**: Receives your command via Rofi, the terminal, or a daemon socket.
2.  **Intent Parsing**: Sends the input to the configured AI provider to determine required actions.
3.  **Tool Selection**: The LLM generates structured tool calls.
4.  **Security Check**: The system analyzes tools for dangerous patterns.
5.  **Execution**: DeskLumina executes the tools, such as launching an app or running a script.
6.  **Response**: The result is streamed back to the UI and spoken via TTS.

---

## Technology Stack

- **Runtime**: [Bun](https://bun.sh/) (Fast JS/TS runtime)
- **Language**: TypeScript
- **AI Inference**: Multi-provider (Groq, OpenAI, Anthropic, Gemini, OpenRouter, Hugging Face) — model configured via `DESKLUMINA_MODEL` or `models.json`
- **UI Architecture**: [Rofi](https://github.com/davatorium/rofi)
- **TTS Engine**: [Edge TTS](https://github.com/rany2/edge-tts) (Universal)
- **Automation**: shell commands via `bash`, plus optional `dunstify` (notifications), `clipcatctl` (clipboard), and `mpc` (media).

---

## Next Steps

- 🏁 **[Installation Guide](02-installation.md)**: Set up DeskLumina on your system.
- 🚀 **[Quick Start](03-quick-start.md)**: Learn basic commands and workflows.
- 🧠 **[Architecture](05-architecture.md)**: Understand the internal design.

---

[← Back to README](../README.md) | [Installation Guide →](02-installation.md)
