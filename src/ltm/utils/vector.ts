export interface ParsedVector {
  ok: boolean;
  vector: number[] | null;
  reason: string | null;
}

export function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function parseEmbeddingJson(raw: string | null | undefined): ParsedVector {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, vector: null, reason: "missing" };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isFiniteNumberArray(parsed)) {
      return { ok: false, vector: null, reason: "invalid-shape" };
    }
    return { ok: true, vector: parsed, reason: null };
  } catch {
    return { ok: false, vector: null, reason: "invalid-json" };
  }
}

export function validateVectorPair(a: number[], b: number[]): ParsedVector {
  if (!isFiniteNumberArray(a) || !isFiniteNumberArray(b)) {
    return { ok: false, vector: null, reason: "invalid-shape" };
  }

  if (a.length !== b.length) {
    return { ok: false, vector: null, reason: "dimension-mismatch" };
  }

  return { ok: true, vector: a, reason: null };
}

function l2Norm(vector: number[]): number {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
  const valid = validateVectorPair(a, b);
  if (!valid.ok) return null;

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
  }

  const normA = l2Norm(a);
  const normB = l2Norm(b);
  const denom = normA * normB;
  if (!Number.isFinite(denom) || denom <= 0) return null;

  const score = dot / denom;
  if (!Number.isFinite(score)) return null;

  return Math.max(-1, Math.min(1, score));
}

export function serializeEmbedding(embedding: number[]): string | null {
  if (!isFiniteNumberArray(embedding)) return null;
  return JSON.stringify(embedding);
}
