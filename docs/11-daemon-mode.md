# 11 - Daemon Mode

DeskLumina daemon mode runs the AI agent as a background service, providing instant responses to commands without startup overhead.

---

## Overview

### What is Daemon Mode?

Daemon mode starts DeskLumina once and keeps it running in the background. The daemon:

- Listens on a Unix socket for incoming commands
- Maintains AI context in memory (no cold starts)
- Provides sub-200ms response times
- Integrates with sxhkd, shell scripts, and desktop widgets

### Benefits

| Feature | Regular Mode | Daemon Mode |
|---------|--------------|-------------|
| **Startup Time** | ~2-3 seconds | <100ms |
| **Memory** | Per-command | Persistent (~45MB) |
| **Response Time** | Cold start | Hot execution |
| **Integration** | Limited | Full sxhkd support |

---

## Quick Start

### Start Daemon

```bash
# Foreground mode (blocks terminal)
bun run daemon

# Background mode (non-blocking)
bun run daemon:start &
```

### Check Status

```bash
bun run daemon:status
```

Output:
```
✓ Daemon is running
Socket: /home/user/.config/bspwm/agent/daemon.sock
```

### Send Commands

```bash
bun run send "open telegram"
bun run send "switch to workspace 3"
bun run send "toggle music"
```

---

## Architecture

### Communication Flow

```
┌─────────────────┐         ┌─────────────────┐
│    Client       │         │    Daemon       │
│  (bun run send) │         │  (Background)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │   HTTP over Unix Socket   │
         │◄─────────────────────────►│
         │                           │
         │  GET /?cmd=open%20tg      │
         │──────────────────────────►│
         │                           │
         │  {"success": true, ...}   │
         │◄──────────────────────────│
         │                           │
```

### Socket Details

- **Location:** `~/.config/bspwm/agent/daemon.sock`
- **Protocol:** HTTP over Unix Domain Socket
- **Request Format:** `GET /?cmd=<url_encoded_command>`
- **Response Format:** JSON

### Request/Response Example

**Request:**
```http
GET /?cmd=open%20telegram HTTP/1.1
Host: unix
```

**Response:**
```json
{
  "success": true,
  "response": "✓ Telegram launched successfully"
}
```

---

## Performance

### Benchmarks

| Operation | Regular Mode | Daemon Mode | Improvement |
|-----------|--------------|-------------|-------------|
| **Cold Start** | 2.8s | 0.1s | 28x faster |
| **App Launch** | 3.2s | 0.2s | 16x faster |
| **File Op** | 2.5s | 0.15s | 17x faster |
| **BSPWM Action** | 2.1s | 0.08s | 26x faster |

### Resource Usage

- **Daemon Process:** ~45MB RAM
- **Per Request:** ~2MB additional
- **Socket Overhead:** Negligible

---

## Systemd Service

### Installation

DeskLumina includes a systemd user service for automatic daemon startup.

### Step 1: Find Your Bun Path

```bash
which bun
```

Common paths:
- `/usr/bin/bun` — System package installation
- `~/.bun/bin/bun` — Bun installer script
- `/usr/local/bin/bun` — Global installation

### Step 2: Update the Service File

Edit `systemd/desklumina-daemon@.service`:

```ini
ExecStart=/path/to/your/bun run src/main.ts --daemon
```

### Step 3: Install the Service

```bash
# Copy service file
cp systemd/desklumina-daemon@.service ~/.config/systemd/user/

# Reload systemd
systemctl --user daemon-reload

# Enable and start
systemctl --user enable --now desklumina-daemon@$(id -u).service
```

### Service Management

```bash
# Check status
systemctl --user status desklumina-daemon@$(id -u).service

# Stop daemon
systemctl --user stop desklumina-daemon@$(id -u).service

# Restart daemon
systemctl --user restart desklumina-daemon@$(id -u).service

# View logs
journalctl --user -u desklumina-daemon@$(id -u).service -f
```

---

## sxhkd Integration

### Configuration

Add to `~/.config/sxhkd/sxhkdrc`:

```
# DeskLumina daemon commands
super + shift + t
    bun run ~/.config/bspwm/agent/src/main.ts --send "open telegram"

super + shift + b
    bun run ~/.config/bspwm/agent/src/main.ts --send "open browser"

super + shift + m
    bun run ~/.config/bspwm/agent/src/main.ts --send "toggle music"

super + shift + w
    bun run ~/.config/bspwm/agent/src/main.ts --send "switch to workspace 2"
```

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

---

## Command Examples

### Application Launching

```bash
bun run send "open telegram"
bun run send "launch browser"
bun run send "open files"
```

### Window Management

```bash
bun run send "move window to workspace 2"
bun run send "toggle fullscreen"
bun run send "focus workspace 1"
```

### File Operations

```bash
bun run send "create folder Projects/NewApp"
bun run send "list files in Documents"
```

### Media Control

```bash
bun run send "play next song"
bun run send "set volume to 50"
bun run send "toggle music"
```

### System Queries

```bash
bun run send "show current time"
bun run send "check disk space"
```

---

## Troubleshooting

### Daemon Won't Start

```bash
# Check if socket already exists
ls -la ~/.config/bspwm/agent/daemon.sock

# Remove stale socket file
rm ~/.config/bspwm/agent/daemon.sock

# Check for existing process
ps aux | grep "main.ts.*daemon"

# Kill existing process
pkill -f "main.ts.*daemon"

# Restart daemon
bun run daemon
```

### Connection Refused

```bash
# Verify daemon is running
bun run daemon:status

# Check socket permissions
ls -la ~/.config/bspwm/agent/daemon.sock

# View logs
tail -f ~/.config/bspwm/agent/logs/general.log
```

### Slow Responses

```bash
# Check system resources
htop

# Verify GROQ_API_KEY is set
echo $GROQ_API_KEY

# Test API status
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
```

### Socket Permission Issues

```bash
# Check socket permissions
ls -la ~/.config/bspwm/agent/daemon.sock

# Remove and restart
rm ~/.config/bspwm/agent/daemon.sock
bun run daemon
```

### Systemd Service Issues

```bash
# Check service status
systemctl --user status desklumina-daemon@$(id -u).service

# View service logs
journalctl --user -u desklumina-daemon@$(id -u).service -n 50

# Reload systemd
systemctl --user daemon-reload

# Re-enable service
systemctl --user enable --now desklumina-daemon@$(id -u).service
```

---

## Related Documentation

- **[Usage Guide](06-usage-guide.md)** — All interaction modes
- **[Troubleshooting](13-troubleshooting.md)** — Common issues
- **[Configuration](04-configuration.md)** — Daemon settings

---

← Previous: [Development Guide](10-development.md) | Next: [Testing Guide](12-testing.md) →