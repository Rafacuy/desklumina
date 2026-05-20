export function sanitizeOrchestrationValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/Authorization\s*:\s*Bearer\s+[^\s"'}]+/gi, "Authorization: Bearer [REDACTED]")
      .replace(/Bearer\s+(gsk_|sk-)[A-Za-z0-9_-]+/g, "Bearer [REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeOrchestrationValue);
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/authorization|api[-_]?key|token|secret/i.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeOrchestrationValue(entry);
      }
    }
    return output;
  }

  return value;
}
