const SENSITIVE_KEY_PATTERN = /api_key|key|token|secret|authorization|x-api-key/i;
const QUERY_PARAM_PATTERN = /([?&])(api_key|key|token|secret|authorization|x-api-key)=[^&]+/gi;
//nuke anything that smells like a secret. 
// including custom X-* headers cz searxng auth uses em
const HEADER_PATTERN = /(Authorization|X-[A-Za-z0-9-]+):\s*\S+/gi;

export function sanitizeLog(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(QUERY_PARAM_PATTERN, "$1$2=REDACTED")
      .replace(HEADER_PATTERN, "$1: REDACTED");
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? "REDACTED" : sanitizeLog(v);
    }
    return out;
  }
  return value; // Not a string or obj, just send it thru
}

export function sanitizeForLog<T>(value: T): T {
  return sanitizeLog(value) as T;
}
