# 01 - Introduction

DeskLumina is an AI-powered desktop automation agent designed for BSPWM-based Linux systems. It enables natural language control of your desktop environment, making complex operations as simple as describing what you want to do.

---

## What is DeskLumina?

DeskLumina bridges the gap between human intent and desktop automation. Instead of memorizing keyboard shortcuts, command-line arguments, and configuration files, you simply tell DeskLumina what you want to accomplish in plain language.

### Example Interactions

```
You: "Open Telegram and move it to workspace 3"
DeskLumina: Launches Telegram, waits for the window, moves it to workspace 3

You: "Create a new project folder called MyApp in ~/Projects"
DeskLumina: Creates the directory with proper path expansion

You: "Play some music and set volume to 50"
DeskLumina: Starts MPD playback and sets volume level
```

---

## Core Philosophy

### Natural Language First

DeskLumina prioritizes natural language understanding over command memorization. The AI interprets your intent and translates it into appropriate desktop actions.

### Security Aware

All commands pass through a security layer that:
- Detects potentially dangerous operations
- Requires confirmation for destructive actions
- Blocks operations on protected system paths
- Implements timeout protection

### Desktop Integration

Built specifically for BSPWM and related tools, DeskLumina provides deep integration with:
- **BSPWM** — Window and workspace management
- **Rofi** — Graphical interface for interactions
- **Dunst** — Desktop notifications
- **Clipcat** — Clipboard management
- **MPD/MPC** — Music player control

---

## Use Cases

### Window Management

- Switch between workspaces
- Move windows across workspaces
- Toggle fullscreen, floating, or monocle modes
- Focus windows by direction

### Application Launching

- Launch applications by natural names or aliases
- Open websites and web services
- Start terminal applications

### File Operations

- Create, move, copy, and delete files
- Search for files by pattern
- Read and write file contents

### Media Control

- Play, pause, skip tracks
- Adjust volume
- View current track information

### System Integration

- Send desktop notifications
- Manage clipboard content
- Execute shell commands safely

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
│                  "Open Telegram on workspace 3"             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Processing                           │
│           Groq API interprets natural language              │
│           Generates structured tool calls                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Security Layer                            │
│           Analyzes commands for dangerous patterns          │
│           Requests confirmation when needed                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool Execution                            │
│           app("telegram")                                   │
│           bspwm("wait_and_move Telegram 3")                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Desktop Action                          │
│           Telegram launches and moves to workspace 3        │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Bun | Fast JavaScript/TypeScript execution |
| Language | TypeScript | Type-safe development |
| AI Backend | Groq API | Low-latency LLM inference |
| UI | Rofi | Graphical interaction |
| Window Manager | BSPWM | Tiling window management |

---

## Requirements

### Essential

- **Bun** v1.3.9 or higher
- **BSPWM** window manager
- **Groq API key** for AI functionality

### Optional (for full features)

- **Rofi** — For interactive mode
- **Dunst** — For notifications
- **Clipcat** — For clipboard management
- **MPD/MPC** — For media control

### Recommended

- [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) — The configuration this tool is designed for

---

## Project Origin

DeskLumina was created to simplify desktop interaction for BSPWM users who prefer natural language over keyboard shortcuts. It's particularly useful for:

- Users who frequently switch between many workspaces
- Those who manage many windows across different applications
- Anyone who wants to automate repetitive desktop tasks
- People who prefer conversational interaction with their system

---

## Next Steps

- **[Installation Guide](02-installation.md)** — Set up DeskLumina on your system
- **[Quick Start](03-quick-start.md)** — Get started with basic commands
- **[Usage Guide](06-usage-guide.md)** — Learn all interaction modes

---

← [Back to README](../README.md) | Next: [Installation](02-installation.md) →