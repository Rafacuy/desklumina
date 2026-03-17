# 09 - Security

DeskLumina implements multiple layers of security to protect your system from accidental or malicious operations.

---

## Security Overview

DeskLumina executes commands on your system based on AI-generated instructions. This requires careful security measures to prevent unintended damage.

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        User Input                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Pattern Analysis (Dangerous Command Detection)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Path Validation (Protected Path Detection)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: User Confirmation (Rofi Dialog)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Timeout Protection (30s limit)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Command Execution                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Dangerous Command Detection

Commands are analyzed against a pattern database before execution. Matching patterns trigger security responses based on severity.

### Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Critical** | System-destructive operations | Requires explicit confirmation |
| **High** | Potentially harmful operations | Requires confirmation |
| **Medium** | System-modifying operations | Logged and warned |
| **Safe** | Read-only operations | No restriction |

---

## Critical Severity Patterns

These patterns require explicit user confirmation:

| Pattern | Description | Example |
|---------|-------------|---------|
| `rm -rf` | Recursive deletion | `rm -rf /tmp/*` |
| `sudo` | Privilege escalation | `sudo apt update` |
| `shutdown` | System shutdown | `shutdown now` |
| `reboot` | System reboot | `reboot` |
| `poweroff` | Power off | `poweroff` |
| `halt` | System halt | `halt` |
| `mkfs` | Format filesystem | `mkfs.ext4 /dev/sda1` |
| `fdisk` | Disk partitioning | `fdisk /dev/sda` |
| `parted` | Partition editor | `parted /dev/sda` |
| `dd` | Low-level copy | `dd if=/dev/zero` |
| `curl \| sh` | Remote code execution | `curl http://x.com \| sh` |
| `wget \| sh` | Remote code execution | `wget http://x.com -O - \| sh` |
| `iptables -F` | Flush firewall | `iptables -F` |
| `update-grub` | Bootloader update | `update-grub` |

---

## High Severity Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `rm` | File deletion | `rm file.txt` |
| `kill` | Process termination | `kill 1234` |
| `pkill` | Kill by name | `pkill firefox` |
| `killall` | Kill all by name | `killall chrome` |
| `systemctl stop` | Stop service | `systemctl stop ssh` |
| `systemctl restart` | Restart service | `systemctl restart nginx` |
| `chmod` | Change permissions | `chmod 777 file` |
| `chown` | Change ownership | `chown root file` |
| `mount` | Mount filesystem | `mount /dev/sda1 /mnt` |
| `umount` | Unmount filesystem | `umount /mnt` |

---

## Medium Severity Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| `cp` | File copying | `cp file /etc/` |
| `wget -o` | Download | `wget -o file http://x.com` |
| `curl -o` | Download | `curl -o file http://x.com` |
| `pip install` | Package install | `pip install package` |
| `npm install` | Package install | `npm install package` |
| `apt install` | Package install | `apt install vim` |
| `pacman -S` | Package install | `pacman -S firefox` |

---

## Safe Operations

Read-only operations that don't require confirmation:

- `ls`, `dir`, `tree` — List files
- `cat`, `head`, `tail` — Read files
- `grep`, `find` — Search
- `pwd`, `whoami`, `hostname` — System info
- `df`, `du`, `free` — Disk/memory info
- `ps`, `top`, `htop` — Process info

---

## Path Protection

### Protected Paths

Operations on these paths always require confirmation:

```
/, /bin, /boot, /dev, /etc, /lib, /root, /sys, /usr, /var
```

### Path Validation Example

| Path | Status | Reason |
|------|--------|--------|
| `~/Documents` | ✅ Safe | User directory |
| `/home/user/file.txt` | ✅ Safe | User-owned path |
| `/etc/config` | ⚠️ Protected | System configuration |
| `/bin/bash` | ⚠️ Protected | System binary |
| `/` | ⚠️ Protected | Root filesystem |

---

## Confirmation System

### Rofi Confirmation Dialog

Dangerous operations trigger a graphical confirmation dialog.

```
┌────────────────────────────────────────────┐
│  ⚠️ Confirm Operation                      │
├────────────────────────────────────────────┤
│                                            │
│  Command: rm -rf /tmp/cache                │
│                                            │
│  This action cannot be undone.             │
│                                            │
│  Severity: HIGH                            │
│                                            │
├────────────────────────────────────────────┤
│  [Cancel]                          [OK]    │
└────────────────────────────────────────────┘
```

### Severity Icons

| Severity | Icon | Color |
|----------|------|-------|
| Critical | ☢️ | Red |
| High | ⚠️ | Orange |
| Medium | ⚡ | Yellow |
| Safe | ✓ | Green |

---

## Timeout Protection

All shell commands have a maximum execution time.

**Default:** 30 seconds

```typescript
const COMMAND_TIMEOUT = 30000; // milliseconds
```

### Why 30 Seconds?

- Prevents hanging processes
- Protects against infinite loops
- Ensures responsive UI
- Most commands complete in <5 seconds

---

## Environment Security

### API Key Storage

API keys are stored in `.env` file, never in code:

```bash
# .env (gitignored)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
MODEL_NAME=openai/gpt-oss-120b
```

### Git Safety

The `.env` file is excluded from version control:

```gitignore
# .gitignore
.env
```

---

## Disabling Security Features

> **Warning:** Disabling security features is not recommended.

To disable confirmation prompts, edit `settings.json`:

```json
{
  "features": {
    "dangerousCommandConfirmation": false
  }
}
```

---

## Security Checklist

Before executing any command:

- [x] Pattern analysis completed
- [x] Path validation passed
- [x] User confirmation obtained (if needed)
- [x] Timeout protection enabled
- [x] Error handling in place

---

## Best Practices

1. **Review commands** — Always check what the AI plans to do
2. **Use confirmation** — Keep dangerous command confirmation enabled
3. **Check paths** — Be careful with system directories
4. **Monitor logs** — Review logs for suspicious activity
5. **Limit scope** — Use specific commands rather than broad operations

---

## Related Documentation

- **[Configuration](04-configuration.md)** — Security settings
- **[Troubleshooting](13-troubleshooting.md)** — Common issues
- **[API Reference](08-api-reference.md)** — Security API

---

← Previous: [API Reference](08-api-reference.md) | Next: [Development Guide](10-development.md) →