import { DANGEROUS_COMMAND_PATTERNS } from "../constants";

export interface DangerousPattern {
  pattern: RegExp;
  category: string;
  description: string;
  severity: "critical" | "high" | "medium";
}

export interface CommandAnalysis {
  isDangerous: boolean;
  matches: DangerousPattern[];
  highestSeverity: "critical" | "high" | "medium" | "safe";
  summary: string;
}

const safePatterns: RegExp[] = [
  /^\s*systemctl\s+(status|is-active|is-enabled|list-units|show)\b/i,
  /^\s*service\s+\S+\s+status\b/i,
  /^\s*ls\b/i,
  /^\s*cat\b/i,
  /^\s*echo\b/i,
  /^\s*pwd\b/i,
  /^\s*whoami\b/i,
  /^\s*date\b/i,
  /^\s*uname\b/i,
  /^\s*df\b/i,
  /^\s*du\b/i,
  /^\s*free\b/i,
  /^\s*top\b/i,
  /^\s*htop\b/i,
  /^\s*ps\b/i,
  /^\s*uptime\b/i,
  /^\s*hostname\b/i,
  /^\s*id\b/i,
  /^\s*which\b/i,
  /^\s*whereis\b/i,
  /^\s*file\b/i,
  /^\s*head\b/i,
  /^\s*tail\b/i,
  /^\s*wc\b/i,
  /^\s*grep\b/i,
  /^\s*stat\b/i,
];

export const dangerousPatterns: DangerousPattern[] = [
  // === CRITICAL ===
  {
    pattern: /\$\(/,
    category: "command_substitution",
    description: "Command substitution $(...)",
    severity: "critical",
  },
  {
    pattern: /`/,
    category: "command_substitution",
    description: "Command substitution backticks",
    severity: "critical",
  },
  {
    pattern: /<\(/,
    category: "process_substitution",
    description: "Process substitution <(...)",
    severity: "critical",
  },
  {
    pattern: /\brm\s+.*(-r|-rf|-fr|--recursive)/i,
    category: "file_deletion_recursive",
    description: "Recursive file/directory deletion",
    severity: "critical",
  },
  {
    pattern: /\brm\s+.*--no-preserve-root\b/i,
    category: "system_deletion",
    description: "Dangerous system-level deletion",
    severity: "critical",
  },
  {
    pattern: /\brm\s+.*(-f|--force)/i,
    category: "file_deletion_force",
    description: "Forced file deletion (force)",
    severity: "critical",
  },
  {
    pattern: /\bsudo\b/i,
    category: "privilege_escalation",
    description: "Privilege escalation (sudo)",
    severity: "critical",
  },
  {
    pattern: /\b(shutdown|reboot|poweroff)\b/i,
    category: "system_power",
    description: "System shutdown/reboot",
    severity: "critical",
  },
  {
    pattern: /\bhalt\b/i,
    category: "system_halt",
    description: "Halt system",
    severity: "critical",
  },
  {
    pattern: /\b(mkfs|fdisk|parted|gdisk)\b/i,
    category: "filesystem_operation",
    description: "Filesystem/partition operation",
    severity: "critical",
  },
  {
    pattern: /\bdd\s+(if|of|bs)=/i,
    category: "disk_operation",
    description: "Low-level disk operation (dd)",
    severity: "critical",
  },
  {
    pattern: /\bcurl\b.*\|\s*(sh|bash|zsh)\b/i,
    category: "remote_code_execution",
    description: "Remote code execution (curl | sh)",
    severity: "critical",
  },
  {
    pattern: /\bwget\b.*-O\s*-\s*\|\s*(sh|bash|zsh)\b/i,
    category: "remote_code_execution",
    description: "Remote code execution (wget | sh)",
    severity: "critical",
  },
  {
    pattern: /\|\s*(sh|bash|zsh)\s*$/i,
    category: "pipe_to_shell",
    description: "Pipe output to shell",
    severity: "critical",
  },
  {
    pattern: />\s*\/dev\/(sd[a-z]|nvme|loop)/i,
    category: "device_write",
    description: "Direct write to device",
    severity: "critical",
  },
  {
    pattern: /\b(nc|ncat|netcat)\b.*-e\b/i,
    category: "reverse_shell",
    description: "Potential reverse shell",
    severity: "critical",
  },
  {
    pattern: />\s*\/dev\/tcp\b/i,
    category: "reverse_shell",
    description: "TCP connection via /dev/tcp",
    severity: "critical",
  },
  {
    pattern: /\biptables\b.*(-F|--flush|-X|--delete-chain)/i,
    category: "firewall_flush",
    description: "Flush firewall rules",
    severity: "critical",
  },

  // === HIGH ===
  {
    pattern: /^\s*rm\b/i,
    category: "file_deletion",
    description: "File deletion",
    severity: "high",
  },
  {
    pattern: /^\s*rmdir\b/i,
    category: "dir_deletion",
    description: "Directory deletion",
    severity: "high",
  },
  {
    pattern: /\bmv\b/i,
    category: "file_move",
    description: "File move/rename",
    severity: "high",
  },
  {
    pattern: /\bsystemctl\s+(stop|restart|disable|mask|kill)\b/i,
    category: "service_control",
    description: "Stop/modify system service",
    severity: "high",
  },
  {
    pattern: /\bservice\s+\S+\s+(stop|restart)\b/i,
    category: "service_control",
    description: "Stop/restart service",
    severity: "high",
  },
  {
    pattern: /\b(killall|pkill)\b/i,
    category: "process_kill",
    description: "Kill process",
    severity: "high",
  },
  {
    pattern: /\bkill\s+(-9|-SIGKILL|-KILL)\b/i,
    category: "process_kill_force",
    description: "Force kill process",
    severity: "high",
  },
  {
    pattern: /\bchmod\b/i,
    category: "permission_change",
    description: "Change file permissions",
    severity: "high",
  },
  {
    pattern: /\b(chown|chgrp)\b/i,
    category: "ownership_change",
    description: "Change file ownership",
    severity: "high",
  },
  {
    pattern: /\b(mount|umount)\b/i,
    category: "mount_operation",
    description: "Mount/unmount operation",
    severity: "high",
  },
  {
    pattern: /\bfsck\b/i,
    category: "filesystem_check",
    description: "Filesystem check",
    severity: "high",
  },
  {
    pattern: /\bcrontab\s+(-r|-e)\b/i,
    category: "cron_modify",
    description: "Crontab modification",
    severity: "high",
  },
  {
    pattern: /\biptables\b/i,
    category: "firewall_change",
    description: "Firewall rule modification",
    severity: "high",
  },
  {
    pattern: /\bufw\s+(disable|delete|reset)\b/i,
    category: "firewall_change",
    description: "Firewall modification (ufw)",
    severity: "high",
  },
  {
    pattern: /\bsystemctl\s+(enable|start)\b/i,
    category: "service_enable",
    description: "Enable system service",
    severity: "high",
  },

  // === MEDIUM ===
  {
    pattern: /^\s*cp\b/i,
    category: "file_copy",
    description: "File copy",
    severity: "medium",
  },
  {
    pattern: /\bwget\b/i,
    category: "download",
    description: "Download file from internet",
    severity: "medium",
  },
  {
    pattern: /\bcurl\b.*-[oO]\b/i,
    category: "download",
    description: "Download file from internet",
    severity: "medium",
  },
  {
    pattern: /\bpip\s+install\b/i,
    category: "package_install",
    description: "Python package installation",
    severity: "medium",
  },
  {
    pattern: /\bnpm\s+(install|i|uninstall|remove)\b/i,
    category: "package_install",
    description: "npm package install/remove",
    severity: "medium",
  },
  {
    pattern: /\b(apt|apt-get|pacman|dnf|yum)\b/i,
    category: "system_package",
    description: "System package operation",
    severity: "medium",
  },
  {
    pattern: /\btee\s+/i,
    category: "file_write",
    description: "Write to file via tee",
    severity: "medium",
  },
];

function isSafeCommand(command: string): boolean {
  return safePatterns.some((p) => p.test(command.trim()));
}

/**
 * Check if a command is dangerous (alias for analyzeCommand)
 */
export function isDangerousCommand(command: string): boolean {
  return analyzeCommand(command).isDangerous;
}

/**
 * Check command for dangerous patterns
 */
export function checkDangerousCommand(command: string): DangerousPattern | null {
  for (const entry of dangerousPatterns) {
    if (entry.pattern.test(command)) {
      return entry;
    }
  }
  return null;
}

/**
 * Analyze command for dangerous patterns
 */
export function analyzeCommand(command: string): CommandAnalysis {
  const matches: DangerousPattern[] = [];
  for (const entry of dangerousPatterns) {
    if (entry.pattern.test(command)) {
      matches.push(entry);
    }
  }

  if (matches.length === 0) {
    return {
      isDangerous: false,
      matches: [],
      highestSeverity: "safe",
      summary: "Safe command",
    };
  }

  const severityOrder: Record<string, number> = {
    critical: 3,
    high: 2,
    medium: 1,
  };

  const highest = matches.reduce((prev, curr) => {
    const prevScore = severityOrder[prev.severity] ?? 0;
    const currScore = severityOrder[curr.severity] ?? 0;
    return currScore > prevScore ? curr : prev;
  });

  const descriptions = [...new Set(matches.map((m) => m.description))];
  const summary = descriptions.join(", ");

  return {
    isDangerous: true,
    matches,
    highestSeverity: highest.severity,
    summary,
  };
}
