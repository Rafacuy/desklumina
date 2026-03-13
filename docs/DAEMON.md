# 🔧 Daemon Mode Documentation

DeskLumina daemon mode runs the AI agent as a background service, providing instant responses to commands without startup overhead. This is ideal for keyboard shortcuts, sxhkd integration, and frequent usage.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Architecture](#architecture)
- [Systemd Service](#systemd-service)
- [Troubleshooting](#troubleshooting)

---

## 📖 Overview

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

## 🚀 Quick Start

### Start Daemon

```bash
# Foreground mode (blocks terminal)
bun run daemon

# Background mode (non-blocking)
bun run daemon:start &

# Or using npm scripts
npm run daemon:start &
```

### Check Status

```bash
# Verify daemon is running
bun run daemon:status
```

### Send Commands

```bash
# Send a command to the daemon
bun run send "open telegram"
bun run send "switch to workspace 3"
bun run send "toggle music"
```

---

## 🎯 Usage

### CLI Commands

| Command | Description |
|---------|-------------|
| `bun run daemon` | Start daemon in foreground |
| `bun run daemon:start` | Start daemon in background |
| `bun run daemon:status` | Check daemon status |
| `bun run send "<cmd>"` | Send command to daemon |

### Command Examples

```bash
# Application launching
bun run send "open browser"
bun run send "launch terminal"
bun run send "open files"

# Window management
bun run send "move window to workspace 2"
bun run send "toggle fullscreen"
bun run send "focus workspace 1"

# File operations
bun run send "create folder Projects/NewApp"
bun run send "list files in Documents"

# Media control
bun run send "play next song"
bun run send "set volume to 50"
bun run send "toggle music"

# System queries
bun run send "show current time"
bun run send "check disk space"
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
lumina "switch to workspace 2"
```

---

## 🏗️ Architecture

### Communication Flow

```
┌─────────────────┐    Unix Socket    ┌─────────────────┐
│   Client        │◄─────────────────►│   Daemon        │
│   (--send)      │   HTTP Request    │   (Background)  │
└─────────────────┘                   └─────────────────┘
                                              │
                                              ▼
                                      ┌─────────────────┐
                                      │   Lumina Core   │
                                      │   (AI + Tools)  │
                                      └─────────────────┘
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

**Error Response:**
```json
{
  "success": false,
  "error": "Application not found"
}
```

---

## ⚡ Performance

### Benchmarks

| Operation | Regular Mode | Daemon Mode | Improvement |
|-----------|--------------|-------------|-------------|
| **Cold Start** | 2.8s | 0.1s | **28x faster** |
| **App Launch** | 3.2s | 0.2s | **16x faster** |
| **File Op** | 2.5s | 0.15s | **17x faster** |
| **BSPWM Action** | 2.1s | 0.08s | **26x faster** |

### Resource Usage

- **Daemon Process:** ~45MB RAM
- **Per Request:** ~2MB additional
- **Socket Overhead:** Negligible

### Optimization Features

- **Persistent AI Context:** No model reloading
- **Tool Registry Cache:** Pre-loaded handlers
- **Socket Reuse:** No TCP overhead
- **JSON Streaming:** Minimal parsing

---

## 🖥️ Systemd Service

### Installation

DeskLumina includes a systemd user service for automatic daemon startup.

> ⚠️ **Important:** Before installing the service, you need to find your `bun` installation path, as it varies depending on how you installed Bun.

#### Step 1: Find Your Bun Path

```bash
which bun
```

Common paths:
- `/usr/bin/bun` - System package installation
- `~/.bun/bin/bun` - Bun installer script
- `/home/YOUR_USER/.bun/bin/bun` - User-specific installation
- `/usr/local/bin/bun` - Global installation

#### Step 2: Update the Service File

Edit the systemd service file and replace `/usr/bin/bun` with your actual path:

```bash
# Open the service file for editing
nano systemd/desklumina-daemon@.service

# Replace this line:
ExecStart=/usr/bin/bun run src/main.ts --daemon

# With your bun path (example):
ExecStart=/home/youruser/.bun/bin/bun run src/main.ts --daemon
```

#### Step 3: Install the Service

```bash
# Copy service file to user systemd directory
cp systemd/desklumina-daemon@.service ~/.config/systemd/user/

# Reload systemd daemon
systemctl --user daemon-reload

# Enable service (auto-start on login)
systemctl --user enable desklumina-daemon@$(id -u).service

# Start the service
systemctl --user start desklumina-daemon@$(id -u).service

# Check status
systemctl --user status desklumina-daemon@$(id -u).service
```

### Service Management

```bash
# Stop daemon
systemctl --user stop desklumina-daemon@$(id -u).service

# Restart daemon
systemctl --user restart desklumina-daemon@$(id -u).service

# Disable auto-start
systemctl --user disable desklumina-daemon@$(id -u).service

# View logs
journalctl --user -u desklumina-daemon@$(id -u).service -f
```

### Service Configuration

The service file (`systemd/desklumina-daemon@.service`):

- Runs as a user service (no root required)
- Sets required environment variables (`DISPLAY`, `XDG_RUNTIME_DIR`)
- Automatically restarts on failure
- Logs to systemd journal
---

## 🔧 Troubleshooting

### Common Issues

#### Daemon Won't Start

```bash
# Check if socket already exists
ls -la ~/.config/bspwm/agent/daemon.sock

# Remove stale socket file
rm ~/.config/bspwm/agent/daemon.sock

# Check for existing daemon process
ps aux | grep "main.ts.*daemon"

# Kill existing process if needed
pkill -f "main.ts.*daemon"

# Restart daemon
bun run daemon
```

#### Connection Refused

```bash
# Verify daemon is running
bun run daemon:status

# Check socket permissions
ls -la ~/.config/bspwm/agent/daemon.sock

# View daemon logs
tail -f ~/.config/bspwm/agent/logs/agent.log | grep daemon

# Restart if needed
pkill -f "desklumina.*daemon"
bun run daemon
```

#### Slow Responses

```bash
# Check system resources
htop

# Verify GROQ_API_KEY is set
echo $GROQ_API_KEY

# Test direct mode (bypass daemon)
bun run src/main.ts --exec "test command"

# Check API status
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models
```

#### Socket Permission Issues

```bash
# Check socket permissions
ls -la ~/.config/bspwm/agent/daemon.sock

# Should be readable/writable by user only
# If not, remove and restart daemon
rm ~/.config/bspwm/agent/daemon.sock
bun run daemon
```

### Debug Mode

```bash
# Start daemon with verbose logging
DEBUG=1 bun run daemon

# Monitor socket activity
watch -n 1 'ls -la ~/.config/bspwm/agent/daemon.sock'

# View all logs
tail -f ~/.config/bspwm/agent/logs/agent.log

# Error logs only
tail -f ~/.config/bspwm/agent/logs/agent-error.log
```

### Log Analysis

```bash
# View daemon-specific logs
grep "daemon" ~/.config/bspwm/agent/logs/agent.log

# View recent errors
tail -100 ~/.config/bspwm/agent/logs/agent-error.log

# Use log viewer
bun run src/utils/log-viewer.ts
```

### Systemd Service Issues

```bash
# Check service status
systemctl --user status desklumina-daemon@$(id -u).service

# View service logs
journalctl --user -u desklumina-daemon@$(id -u).service -n 50

# Reload systemd after config changes
systemctl --user daemon-reload

# Re-enable service
systemctl --user enable --now desklumina-daemon@$(id -u).service
```

---

## 🔗 Related Documentation

- [API Reference](./API.md) - Core API documentation
- [Tools Documentation](./TOOLS.md) - Available tools and usage
- [Development Guide](./DEVELOPMENT.md) - Development setup
- [Security Documentation](./SECURITY.md) - Security features

---

<div align="center">

**Performance First!** Use daemon mode for the best DeskLumina experience.

*Last updated: March 2026*

</div>
