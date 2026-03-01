/**
 * Command timeout in milliseconds (30 seconds)
 */
export const COMMAND_TIMEOUT = 30000;

/**
 * Dangerous command patterns that require confirmation
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  /^rm\s+(-rf?|--recursive)\s/i,
  /^kill\s+-?\d/i,
  /^pkill\s/i,
  /^shutdown\s/i,
  /^reboot\s/i,
  /^systemctl\s+(poweroff|reboot)/i,
] as const;

/**
 * Confirmation keywords for dangerous operations
 */
export const CONFIRMATION_KEYWORDS = [
  "ya",
  "yes",
  "y",
  "confirm",
  "setuju",
  "iya",
] as const;
