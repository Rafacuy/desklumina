# 01 - Introduction

DeskLumina is an intelligent, high-performance desktop automation agent designed specifically for Linux desktop environments. It enables natural language control of your system, making complex operations as simple as describing your intent.

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

DeskLumina bridges the gap between human intent and system execution. Built as a native Linux integration, it leverages the speed of **Bun** and the intelligence of the **Groq API** to provide an assistant that feels like a natural extension of your desktop environment.

## Core Philosophy

### Natural Language First
Instead of memorizing keyboard shortcuts, CLI arguments, or configuration syntax, you simply tell DeskLumina what you want to accomplish in plain language.

### Performance & Responsiveness
DeskLumina streams model output from the Groq API and can optionally run text-to-speech for the assistant response.

### Secure by Design
Every command is analyzed for safety. Destructive or sensitive operations require explicit user confirmation through a Rofi-based dialog, ensuring you remain in full control.

---

## Example Interactions

> **User:** "open telegram"
> **DeskLumina:** (executes tool call `app` with `telegram`)

> **User:** "create a folder on Desktop"
> **DeskLumina:** (executes tool call `file` with `create_dir ~/Desktop/...`)

> **User:** "play music"
> **DeskLumina:** (executes tool call `media` with `play`)

---

## Key Features

- **🪟 Rofi Integration**: A lightweight, keyboard-friendly UI that fits perfectly into tiling window managers (i3, bspwm, sway, etc.).
- **🔊 Low-Latency TTS**: Near-instant voice responses using the `AdaptiveChunker` and Edge TTS.
- **🤖 Smart Daemon**: A persistent background service that eliminates startup overhead.
- **🛡️ Security Layer**: Automatic detection of dangerous commands with interactive confirmation.
- **🔧 Extensible Tools**: A modular system for controlling applications, files, media, and more.
- **🌐 Bilingual**: Native support for English and Indonesian.

---

## Why DeskLumina?

Modern desktops are powerful but often complex. DeskLumina was created for users who:
- Want to automate repetitive tasks without writing scripts.
- Prefer natural language over complex keyboard shortcuts.
- Need a lightweight, customizable assistant that doesn't bloat the system.

---

## How It Works

1.  **Input**: Receives your command via Rofi, the terminal, or a daemon socket.
2.  **Intent Parsing**: Sends the input to the Groq API (LLM) to determine required actions.
3.  **Tool Selection**: The LLM generates structured "tool calls" (JSON blocks).
4.  **Security Check**: The system analyzes the tools for dangerous patterns.
5.  **Execution**: DeskLumina executes the tools (e.g., launching an app or running a script).
6.  **Response**: The result is streamed back to the UI and spoken via TTS.

---

## Technology Stack

- **Runtime**: [Bun](https://bun.sh/) (Fast JS/TS runtime)
- **Language**: TypeScript
- **AI Inference**: [Groq API](https://groq.com/) (model configured via `MODEL_NAME`)
- **UI Architecture**: [Rofi](https://github.com/davatorium/rofi)
- **TTS Engine**: [Edge TTS](https://github.com/rany2/edge-tts) (Universal)
- **Automation**: shell commands via `bash`, plus optional `dunstify` (notifications), `clipcatctl` (clipboard), and `mpc` (media).

---

## Next Steps

- 🏁 **[Installation Guide](02-installation.md)** — Set up DeskLumina on your system.
- 🚀 **[Quick Start](03-quick-start.md)** — Learn basic commands and workflows.
- 🧠 **[Architecture](05-architecture.md)** — Understand the internal design.

---

[← Back to README](../README.md) | [Installation Guide →](02-installation.md)
