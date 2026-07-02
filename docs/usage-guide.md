# Usage & Daemon Guide

DeskLumina offers multiple ways to interact, from a floating UI to a persistent background service.

## Contents

- [Interactive Mode (Rofi)](#interactive-mode-rofi)
- [The Agent Loop (ReAct)](#the-agent-loop-react)
- [Background Execution](#background-execution)
- [Terminal Mode](#terminal-mode)
- [Daemon Mode](#daemon-mode)
  - [Running the Daemon](#running-the-daemon)
  - [Daemon Behavior](#daemon-behavior)
  - [Health and Diagnostics](#health-and-diagnostics)
  - [Systemd Integration](#systemd-integration)
  - [Daemon Security](#daemon-security)

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

## Daemon Mode

Daemon mode runs DeskLumina as a persistent background process. It binds to a Unix socket[^3] and waits for commands.

Daemon mode eliminates the startup overhead of spinning up the Bun runtime and parsing configurations for every single request. When the daemon starts, it performs a one-time warmup of configuration caches, themes, and the long-term memory store, then keeps everything in memory for subsequent requests.

[^3]: `src/daemon/daemon.ts` — socket path: `$XDG_RUNTIME_DIR/desklumina.sock`

### Running the Daemon

1. Start the daemon in the background:

   ```bash
   bun run daemon:start
   ```

2. Verify it is running:

   ```bash
   bun run daemon:status
   ```

   Success looks like: `Daemon is running (PID …)`. If the command returns nothing or an error, see [Troubleshooting](./troubleshooting.md#socket-already-in-use-eaddrinuse).

3. Send a command to the running daemon:

   ```bash
   bun run send "open telegram"
   ```

   The daemon processes the request and returns the final text output directly to the terminal.

You now have a persistent daemon that accepts commands without per-request startup cost. To have it start on login, continue to [Systemd Integration](#systemd-integration).

### Daemon Behavior

The daemon processes one command at a time. When a request arrives, it:

1. Validates the authorization token
2. Checks the command length (maximum 8192 characters)
3. Executes the request through the agent loop
4. Returns a JSON response with the assistant's reply, any tool results, and metadata

The daemon watches configuration files for changes and reloads caches automatically when you modify settings, themes, or app aliases. You can also trigger a manual cache warmup by sending `SIGUSR1` to the daemon process.

### Health and Diagnostics

The daemon exposes two HTTP endpoints on the Unix socket for monitoring and debugging:

- **Health check**: Send a request to `/health` or `/v1/healthz` to verify the daemon is alive. Returns the process ID and uptime in seconds.
- **Diagnostics**: Request `/v1/diag` to get cache status and configuration information for troubleshooting.

These endpoints are useful for monitoring scripts or automated health checks.

### Systemd Integration

1. Confirm the path to your `bun` executable:

   ```bash
   which bun
   ```

   Expected output: something like `/home/user/.bun/bin/bun`.

2. Open `systemd/desklumina-daemon.service` and verify the `ExecStart` line matches the path from step 1.

3. Install and enable the service:

   ```bash
   cp systemd/desklumina-daemon.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now desklumina-daemon.service
   ```

4. Confirm it is active:

   ```bash
   systemctl --user status desklumina-daemon.service
   ```

   The output should show `Active: active (running)`.

The daemon now starts automatically at login. All subsequent commands use `bun run send "…"` without any further setup.

### Daemon Security

> [!IMPORTANT]
> Any process that can read `~/.config/desklumina/.daemon-token` can send commands to the daemon. Keep this file's permissions at `0600` (the default) and do not share it.

On startup, the daemon generates a session token at `~/.config/desklumina/.daemon-token` with `0600` permissions. Any client sending commands via the Unix socket must read this token and pass it as a `Bearer` authorization header.
