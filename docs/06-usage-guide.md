# 06 - Usage Guide

This guide covers all interaction modes and features of DeskLumina in detail.

---

## Interaction Modes

DeskLumina supports four distinct interaction modes:

| Mode | Command | Best For |
|------|---------|----------|
| Interactive (Rofi) | `bun start` | Desktop use, visual feedback |
| Terminal Chat | `bun run dev` | Development, debugging |
| Direct Execution | `bun run src/main.ts --exec "cmd"` | Scripts, sxhkd |
| Daemon | `bun run daemon` | Background service, hotkeys |

---

## Interactive Mode (Rofi)

The graphical interface powered by Rofi provides a user-friendly way to interact with DeskLumina.

### Starting

```bash
bun start
```

### Interface Flow

```
┌─────────────────────────────────────────┐
│  DeskLumina                              │
│  ──────────────────────────────────────  │
│  Enter your command:                     │
│  _________________________________       │
│                                          │
└─────────────────────────────────────────┘
```

### Features

- **Input Dialog** — Type natural language commands
- **Response Display** — View AI responses with formatting
- **Tool Execution** — See tools being executed in real-time
- **Chat Management** — Start new chats, load previous conversations

### Actions

| Action | Description |
|--------|-------------|
| Type command | Enter your request |
| Enter | Submit command |
| Esc | Close dialog |

### Workflow Example

1. Press your sxhkd hotkey to launch DeskLumina
2. Type: "open telegram and move it to workspace 3"
3. Press Enter
4. Watch the response showing execution
5. Press Esc to close

---

## Terminal Chat Mode

A command-line interface ideal for development and debugging.

### Starting

```bash
bun run dev
```

### Interface

```
💫 Lumina Terminal Chat Mode
Type 'exit' to quit, 'new' for new chat, 'list' to see chats

You: open telegram
DeskLumina: ✓ Telegram launched successfully

You [Desktop Setup]: 
```

### Chat Commands

| Command | Description |
|---------|-------------|
| `exit` | Close the application |
| `new` | Start a new chat session |
| `list` | Display all saved chats |
| `load <n>` | Load chat by number |

### Session Example

```
You: list

1. Desktop Setup (5 msgs) *
2. File Organization (3 msgs)
3. Music Control (8 msgs)

Use 'load <number>' to switch chats.

You: load 2
Loaded: File Organization

You [File Organization]: show me the files in downloads
DeskLumina: Here are the files in your Downloads folder...

You: exit
Goodbye! 👋
```

### Advantages

- Real-time streaming output
- Easy copy/paste
- Full terminal features
- Debugging visibility

---

## Direct Execution

Execute single commands without maintaining a conversation.

### Syntax

```bash
bun run src/main.ts --exec "your command here"
```

### Examples

```bash
# Launch application
bun run src/main.ts --exec "open telegram"

# Window management
bun run src/main.ts --exec "switch to workspace 3"

# File operations
bun run src/main.ts --exec "create folder Test in ~/Documents"

# Media control
bun run src/main.ts --exec "toggle music playback"

# System query
bun run src/main.ts --exec "what time is it"
```

### Use Cases

- **sxhkd keybindings** — Bind hotkeys to commands
- **Shell scripts** — Automate desktop tasks
- **Cron jobs** — Scheduled operations
- **Pipe integration** — Chain with other commands

### sxhkd Integration

Add to `~/.config/sxhkd/sxhkdrc`:

```
# DeskLumina quick commands
super + shift + t
    bun run ~/.config/bspwm/agent/src/main.ts --exec "open telegram"

super + shift + b
    bun run ~/.config/bspwm/agent/src/main.ts --exec "open browser"

super + shift + m
    bun run ~/.config/bspwm/agent/src/main.ts --exec "toggle music"
```

---

## Daemon Mode

Run DeskLumina as a background service for instant command execution.

### Starting the Daemon

```bash
# Foreground (blocks terminal)
bun run daemon

# Background
bun run daemon:start &

# Or with systemd
systemctl --user start desklumina-daemon@$(id -u).service
```

### Checking Status

```bash
bun run daemon:status
```

Output:
```
✓ Daemon is running
Socket: /home/user/.config/bspwm/agent/daemon.sock
```

### Sending Commands

```bash
bun run send "open telegram"
bun run send "switch to workspace 2"
bun run send "toggle music"
```

### Performance Comparison

| Operation | Direct Mode | Daemon Mode |
|-----------|-------------|-------------|
| Cold start | ~2.8s | ~0.1s |
| App launch | ~3.2s | ~0.2s |
| BSPWM action | ~2.1s | ~0.08s |

### Shell Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias ai='bun run ~/.config/bspwm/agent/src/main.ts --send'
alias lumina='bun run ~/.config/bspwm/agent/src/main.ts --send'
```

Usage:
```bash
ai "open telegram"
lumina "switch to workspace 3"
```

For complete daemon setup, see [Daemon Mode Guide](11-daemon-mode.md).

---

## Chat Management

DeskLumina maintains persistent chat history with auto-generated titles.

### Chat Storage

Chats are stored in:
```
~/.config/bspwm/agent/chats/
```

### Managing Chats

**List chats:**
```
You: list
```

**Load specific chat:**
```
You: load 2
```

**Start new chat:**
```
You: new
```

### Chat Titles

Titles are automatically generated from the first message. For example:
- "open telegram" → "Open Telegram"
- "create a folder called MyApp" → "Create MyApp Folder"

---

## Context Awareness

When `windowContext` is enabled, DeskLumina knows about your current window.

### Information Captured

- Window class (application identifier)
- Window title
- Active workspace

### Example Usage

```
# Context-aware command
You: move this window to workspace 3
DeskLumina: ✓ Moved Alacritty to workspace 3

# The AI knows "this window" refers to the active window
```

### How It Works

1. Before each command, window info is captured
2. Context is included in the system prompt
3. AI can reference the current window in responses

---

## Text-to-Speech

Enable voice responses with TTS.

### Enabling TTS

Edit `settings.json`:
```json
{
  "features": {
    "tts": true
  },
  "tts": {
    "voiceId": "id-ID-GadisNeural",
    "speed": 1
  }
}
```

### Available Voices

| Voice ID | Language | Gender |
|----------|----------|--------|
| `id-ID-GadisNeural` | Indonesian | Female |
| `id-ID-ArdiNeural` | Indonesian | Male |
| `en-US-JennyNeural` | English (US) | Female |
| `en-US-GuyNeural` | English (US) | Male |

### Speed Options

Valid values: `0.5`, `0.75`, `1.0`, `1.25`, `1.5`, `2.0`

---

## Settings Menu

Access the settings menu from the Rofi interface to toggle features.

### Available Settings

| Setting | Description |
|---------|-------------|
| TTS | Enable/disable voice responses |
| Tool Display | Show/hide tool execution |
| Chat History | Enable/disable chat persistence |
| Window Context | Include active window in context |
| Security Confirmation | Require confirmation for dangerous commands |

---

## Command Examples

### Window Management

```
switch to workspace 3
move window to workspace 2
toggle fullscreen
close this window
focus the window to the left
```

### Application Launching

```
open telegram
open browser
launch neovim
start music player
```

### File Operations

```
list files in Downloads
create folder Projects in home
read the file ~/.bashrc
delete test.txt in Downloads
find all pdf files in Documents
```

### Media Control

```
play music
pause playback
next song
set volume to 50
what's playing
```

### System Operations

```
show clipboard history
copy this text: Hello World
send notification: Task complete
what time is it
```

---

## Tips and Best Practices

### Natural Language

Write commands naturally:
```
✓ "can you open telegram please"
✓ "I want to switch to workspace 2"
✓ "what's the current time?"
```

### Chaining Operations

Combine multiple actions:
```
✓ "open telegram and move it to workspace 3"
✓ "play music and set volume to 30"
✓ "create folder MyApp and open terminal there"
```

### Specificity

Be specific for complex operations:
```
✓ "move the active window to workspace 2"
✓ "create a folder called TestProject in ~/Projects"
✓ "delete the file old-config.txt in the Downloads folder"
```

### Context Reference

Reference the current context:
```
✓ "move this window to workspace 3"
✓ "close the current window"
✓ "what application is this?"
```

---

## Related Documentation

- **[Tools Reference](07-tools-reference.md)** — Complete tool documentation
- **[Daemon Mode](11-daemon-mode.md)** — Daemon setup details
- **[Configuration](04-configuration.md)** — Customize settings

---

← Previous: [Architecture](05-architecture.md) | Next: [Tools Reference](07-tools-reference.md) →