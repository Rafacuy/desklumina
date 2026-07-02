# Security

DeskLumina automates your desktop, which means it has the power to run shell commands and modify files. It uses a Human-in-the-Loop (HITL) model to ensure the AI cannot destroy your system without your approval.

## Contents

- [Terminal Command Scanning](#terminal-command-scanning)
- [Path Restrictions (File Tool)](#path-restrictions-file-tool)
- [Timeouts](#timeouts)

## Terminal Command Scanning

Every command passed to the `terminal` tool is analyzed before execution.[^1] The scanner looks for dangerous patterns anywhere in the string, preventing bypasses that hide malicious flags at the end of a long chain.

| Severity | Examples | Outcome |
| --- | --- | --- |
| Critical | `rm -rf`, `reboot`, `dd`, `sudo`, `$(...)`, backtick substitutions | Confirmation dialog required |
| High | `mv`, `chmod`, `systemctl stop` | Confirmation dialog required |
| Medium | `npm i`, `wget`, `curl` | Confirmation dialog required |
| Safe | `ls`, `cat`, `grep` | Executed immediately |

If a command evaluates to Medium, High, or Critical, DeskLumina pauses execution. It presents a Rofi dialog showing the exact command and asks for your explicit approval.

[^1]: `src/security/dangerous-commands.ts`

## Path Restrictions (File Tool)

The `file` tool enforces its own strict guardrails independent of the terminal scanner.

Operations targeting critical system paths (`/`, `/bin`, `/boot`, `/dev`, `/etc`, `/lib`, `/proc`, `/root`, `/run`, `/sbin`, `/sys`, `/usr`, `/var`) trigger a confirmation dialog.

> [!CAUTION]
> The `delete` operation refuses to target `/` or `$HOME` outright, bypassing confirmation and immediately failing the tool call. This cannot be overridden.

## Timeouts

To prevent hung background processes from consuming system resources, all blocking terminal commands run with a strict 30-second timeout. If a process does not complete within that window, it is forcefully killed and an error is returned to the agent loop.
