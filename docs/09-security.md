# 09 - Security

How DeskLumina protects your system while providing powerful automation.

---

## Table of Contents

- [Security Philosophy](#security-philosophy)
- [Dangerous Command Detection](#dangerous-command-detection)
- [Confirmation System](#confirmation-system)
- [Path Restrictions](#path-restrictions)
- [Timeout Protection](#timeout-protection)

---

## Security Philosophy

DeskLumina follows a **Human-in-the-Loop** (HITL) security model. We believe that while AI is incredibly capable, users should always have the final say on actions that could result in data loss or system instability.

1.  **Transparency**: Users should always know what a tool is about to do.
2.  **Consent**: Destructive actions must require explicit user approval.
3.  **Safety Defaults**: By default, DeskLumina is configured with conservative security settings.

---

## Dangerous Command Detection

Every command passed to the **Terminal** or **File** tools is scanned by a rule-based analyzer before execution. DeskLumina uses consistent word boundary enforcement (`\b`) to ensure dangerous commands are detected even when they are not at the beginning of a command string.

**Logic**: `src/security/dangerous-commands.ts`

### Embedded Command Detection

The security engine does not rely on simple prefix matching. It scans the entire command string for dangerous patterns. For example, a command like `ls; rm -rf /` will correctly trigger a **Critical** severity warning because the recursive deletion is detected even though it follows a safe command.

### Severity Levels:

| Level | Definition | Action |
|-------|------------|--------|
| **Safe** | Read-only or standard operations (e.g., `ls`, `free`). | Execute immediately. |
| **Medium** | Potentially destructive or system-impacting (e.g., `cp`, `npm install`). | **Require confirmation.** |
| **High** | More destructive operations (e.g., `rm`, `mv`, `chmod`). | **Require confirmation.** |
| **Critical** | High risk of data loss/system failure (e.g., `rm -rf`, `sudo`, `$(...)`). | **Require confirmation.** |

### Command Substitution Protection

DeskLumina explicitly detects and blocks nested command execution within terminal strings. Patterns for command substitution (`$(...)`, `` `...` ``) and process substitution (`<(...)`) are classified as **Critical** risks. This prevents bypass attacks where a dangerous command is hidden inside an otherwise safe-looking command.

---

## Confirmation System

When a command is flagged as **High** or **Critical** severity, DeskLumina pauses execution and prompts the user.

**Logic**: `src/security/confirmation.ts`

- **Rofi Dialog**: A specialized Rofi window appears with the full command and a "Yes/No" prompt.

---

## Path Restrictions

The **File** tool implements restrictions to prevent accidental modification of system-critical files. Path interpolation is handled via array-based spawning, which eliminates shell injection vulnerabilities by bypassing the shell layer entirely.

### Protected Directories:
- `/bin`, `/boot`, `/dev`, `/etc`, `/lib`, `/root`, `/sys`, `/usr`, `/var`

Any operation (move, delete, write) targeting these paths will trigger a **High** severity confirmation, even if the command itself isn't inherently flagged as dangerous. Normalization and path expansion (e.g., `~` to `$HOME`) are performed before security analysis to ensure consistent protection.

---

## Timeout Protection

To prevent runaway processes or hung tools from freezing your desktop:

- **Terminal Timeout**: All shell commands have a default **30-second timeout**. If a command takes longer, it is forcefully killed.

---

## Next Steps

- 🤖 **[Daemon Mode](11-daemon-mode.md)** — Security in background services.
- ⚙️ **[Configuration](04-configuration.md)** — Adjusting security levels.
- 🧪 **[Testing Guide](12-testing.md)** — Verifying security rules.

---

[← API Reference](08-api-reference.md) | [Development Guide →](10-development.md)
