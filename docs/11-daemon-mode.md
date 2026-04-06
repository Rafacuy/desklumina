# 11 - Daemon Mode

Optimize DeskLumina for instant response times with persistent background execution.

---

## Table of Contents

- [Introduction](#introduction)
- [Why Daemon Mode?](#why-daemon-mode)
- [Quick Start](#quick-start)
- [Systemd User Service](#systemd-user-service)
- [Advanced Integration (sxhkd)](#advanced-integration-sxhkd)
- [Troubleshooting](#troubleshooting)

---

## Introduction

Daemon mode runs DeskLumina as a persistent background process. The daemon stays active and listens for incoming commands over a **Unix Domain Socket** at `~/.config/desklumina/daemon.sock`.

---

## Why Daemon Mode?

- Avoids starting a new Bun process for every command.\n+- Provides a stable socket endpoint for hotkeys and scripts.\n+- Each request is handled independently by the daemon (a new chat is created per command in the daemon handler).

---

## Quick Start

### 1. Start the Daemon
```bash
# Start in the foreground (blocks terminal)
bun run daemon

# Start in the background (non-blocking, the script already includes &)
bun run daemon:start
```

### 2. Check Daemon Status
```bash
bun run daemon:status
```

### 3. Send a Command
Once the daemon is running, use the `send` command to interact with it:
```bash
bun run send "open telegram"
bun run send "what's the current volume?"
```

---

## Systemd User Service

Automate DeskLumina's startup with the provided service file: `systemd/desklumina-daemon@.service`.

1.  **Verify Bun path**: the service file uses `/usr/bin/bun`. If your Bun lives elsewhere, update `ExecStart` accordingly.
2.  **Install the Service**:
    ```bash
    # 1. Copy service file
    cp systemd/desklumina-daemon@.service ~/.config/systemd/user/

    # 2. Reload systemd
    systemctl --user daemon-reload

    # 3. Enable and start
    systemctl --user enable --now desklumina-daemon@$(id -u).service
    ```
4.  **Manage Service**:
    - `systemctl --user status desklumina-daemon@$(id -u).service`
    - `systemctl --user restart desklumina-daemon@$(id -u).service`

---

## Advanced Integration (sxhkd)

For power users, daemon mode allows for instant "hotkey-driven" AI commands.

Add these to your `~/.config/sxhkd/sxhkdrc`:

```bash
# Instant AI Command
super + t
    bun run ~/.config/desklumina/src/main.ts --send "what's on my schedule?"

# Media Toggle
super + space
    bun run ~/.config/desklumina/src/main.ts --send "toggle music"

# Quick Browser
super + b
    bun run ~/.config/desklumina/src/main.ts --send "open chrome"
```

---

## Troubleshooting

- **Socket Already in Use**: If the daemon crashes, the socket file might remain. Run `rm ~/.config/desklumina/daemon.sock` and restart.
- **Connection Refused**: Ensure the daemon is actually running with `bun run daemon:status`.
- **Logs**: Check `~/.config/desklumina/logs/general.log` and `~/.config/desklumina/logs/error.log`.

---

## Next Steps

- ⚙️ **[Configuration](04-configuration.md)** — Customizing daemon behavior.
- 🧪 **[Testing](12-testing.md)** — Verifying socket communication.
- 🏁 **[Back to Introduction](01-introduction.md)**

---

[← Development Guide](10-development.md) | [Testing →](12-testing.md)
