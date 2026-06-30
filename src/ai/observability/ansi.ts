const RESET = "\x1b[0m";

export function colorEnabledForStream(useStdout: boolean): boolean {
  const noColor = Bun.env.NO_COLOR;
  if (noColor !== undefined && noColor !== "") {
    return false;
  }
  const force = Bun.env.FORCE_COLOR;
  if (force === "1" || force === "true") {
    return true;
  }
  return useStdout ? !!process.stdout.isTTY : !!process.stderr.isTTY;
}

export function rgbFg(r: number, g: number, b: number, text: string, enabled: boolean): string {
  if (!enabled) return text;
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

export function severityStyle(severity: "debug" | "info" | "warn" | "error", text: string, enabled: boolean): string {
  if (!enabled) return text;
  switch (severity) {
    case "debug":
      return `\x1b[38;2;100;140;160m${text}${RESET}`;
    case "info":
      return `\x1b[38;2;110;180;130m${text}${RESET}`;
    case "warn":
      return `\x1b[38;2;200;170;90m${text}${RESET}`;
    case "error":
      return `\x1b[38;2;210;100;100m${text}${RESET}`;
    default:
      return text;
  }
}
