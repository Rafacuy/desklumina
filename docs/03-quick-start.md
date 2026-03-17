# 03 - Quick Start

Get up and running with DeskLumina in minutes. This guide covers the essential commands and workflows.

---

## First Run

After completing the [Installation](02-installation.md), test DeskLumina with terminal chat mode:

```bash
bun run dev
```

You'll see:

```
💫 Lumina Terminal Chat Mode
Type 'exit' to quit, 'new' for new chat, 'list' to see chats

You:
```

Try your first command:

```
You: what time is it
```

---

## Basic Commands

Here are some common commands to get started:

### Application Launching

```
open telegram
open browser
open files
launch neovim
```

### Window Management

```
switch to workspace 3
move window to workspace 2
toggle fullscreen
close this window
```

### File Operations

```
list files in Downloads
create folder called Test in ~/Documents
read the file ~/.bashrc
```

### Media Control

```
play music
pause
next song
set volume to 50
```

### System Queries

```
what time is it
show current window info
list all workspaces
```

---

## Interactive Mode (Rofi)

For a graphical interface, use Rofi mode:

```bash
bun start
```

This opens a Rofi dialog where you can:
1. Type your command
2. See the AI response
3. Continue the conversation

### Rofi Interface Flow

```
┌─────────────────────────────────────┐
│  Enter your command:                │
│  _________________________________  │
│                                     │
└─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  AI Response:                       │
│  ✓ Telegram launched successfully   │
│                                     │
│  [Continue] [New Chat] [Settings]   │
└─────────────────────────────────────┘
```

---

## Direct Execution

For quick, one-off commands without conversation:

```bash
bun run src/main.ts --exec "open telegram"
```

This is useful for:
- Shell scripts
- Keyboard shortcuts (sxhkd)
- Automation pipelines

---

## Terminal Chat Commands

While in terminal chat mode (`bun run dev`), these special commands are available:

| Command | Description |
|---------|-------------|
| `exit` | Close the application |
| `new` | Start a new chat session |
| `list` | Display all saved chats |
| `load <n>` | Load a specific chat by number |

### Example Session

```
You: list

1. Desktop Setup (5 msgs)
2. File Organization (3 msgs)
3. Music Control (8 msgs)

Use 'load <number>' to switch chats.

You: load 1
Loaded: Desktop Setup

You [Desktop Setup]: continue from where we left off
```

---

## Understanding Responses

When you issue a command, DeskLumina:

1. **Interprets** your natural language
2. **Plans** the necessary actions
3. **Executes** tools in sequence
4. **Reports** the results

### Example Response

```
You: open telegram and move it to workspace 3

DeskLumina: I'll launch Telegram and move it to workspace 3 for you.

[Executing: app("telegram")]
[Executing: bspwm("wait_and_move Telegram 3")]

✓ Telegram launched and moved to workspace 3
```

---

## Tips for Best Results

### Be Natural

Write commands as you would speak them:

```
✓ "open telegram"
✓ "can you open telegram please"
✓ "I need telegram"
```

### Be Specific for Complex Operations

```
✓ "move the active window to workspace 2"
✓ "create a folder called Projects in my home directory"
✓ "delete the file test.txt in Downloads folder"
```

### Chain Related Actions

```
✓ "open browser and switch to workspace 1"
✓ "play music and set volume to 30"
✓ "create folder MyApp and open it in terminal"
```

---

## What's Happening

Behind the scenes, DeskLumina:

1. Sends your input to the Groq API
2. The AI generates tool calls in JSON format
3. Tools are parsed and executed
4. Results are returned to you

### Tool Call Example

Your input:
```
open telegram
```

AI generates:
```json
{"tool": "app", "args": "telegram"}
```

Tool executes:
```typescript
await app("telegram")  // → "✓ Telegram launched"
```

---

## Security Prompts

Some commands may trigger security confirmations:

```
⚠️ Confirm Operation

Command: rm -rf ~/test
Risk Level: HIGH

This action cannot be undone.

[Cancel]  [Confirm]
```

This protects against:
- Accidental file deletion
- System modification
- Potentially dangerous commands

---

## Next Steps

Now that you're familiar with the basics:

- **[Configuration](04-configuration.md)** — Customize settings and features
- **[Usage Guide](06-usage-guide.md)** — Explore all modes in detail
- **[Tools Reference](07-tools-reference.md)** — Learn all available tools

---

← Previous: [Installation](02-installation.md) | Next: [Configuration](04-configuration.md) →