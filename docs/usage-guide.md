# Usage Guide

DeskLumina offers multiple ways to interact, from a floating UI to a persistent background service.

## Contents

- [Interactive Mode (Rofi)](#interactive-mode-rofi)
- [The Agent Loop (ReAct)](#the-agent-loop-react)
- [Background Execution](#background-execution)
- [Terminal Mode](#terminal-mode)

## Interactive Mode (Rofi)

This is the primary interface for daily tasks. It provides visual chat history and quick access to settings.

Launch it with:

```bash
bun run start
```

For faster subsequent launches, compile the binary first (`bun run build`) and then use `bun run start:prod`.

| Key | Action |
| --- | --- |
| <kbd>Enter</kbd> | Submit message |
| <kbd>Tab</kbd> | Toggle expanded History / Settings menu |
| <kbd>Esc</kbd> | Exit the UI |
| <kbd>Alt</kbd>+<kbd>R</kbd> | Retry a failed request |
| <kbd>Alt</kbd>+<kbd>C</kbd> | Copy the error string to clipboard |

If a request fails, an inline error panel appears. Use <kbd>Alt</kbd>+<kbd>R</kbd> to retry or <kbd>Alt</kbd>+<kbd>C</kbd> to copy the error. See [Troubleshooting](./troubleshooting.md#the-error-panel) if the error panel persists.

## The Agent Loop (ReAct)

DeskLumina uses a ReAct (Reason + Act) loop.[^1] When you send a command, the assistant does not just guess the answer. It reasons about your request, decides which tool to call, executes it, and reviews the output.

If a tool returns an error (like a locked file or temporary network issue), the agent can automatically retry or adjust its arguments without bothering you. If a command requires multiple steps ("check if telegram is running, and if not, launch it"), the agent executes those steps sequentially.

[^1]: `src/agent/agent.ts`

## Background Execution

Certain tools fire and forget. When you ask DeskLumina to open an app (e.g. "open firefox") or send a desktop notification, the agent dispatches the command and immediately considers its turn complete. The application launches in the background.

If a background operation fails after launch, the agent injects that failure into your next chat prompt, ensuring it knows the current system state.[^2]

[^2]: `src/tools/result-store.ts`

## Terminal Mode

For developers or long-form chat sessions, DeskLumina provides a persistent terminal loop with live streaming.

Launch it with:

```bash
bun run dev
```

Inside the terminal loop:

| Command | Effect |
| --- | --- |
| `exit` | Quit the loop |
| `new` | Clear the current context |
| `list` | View saved chat sessions |
| `load <number>` | Restore a previous session |
