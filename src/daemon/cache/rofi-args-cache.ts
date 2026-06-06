interface RofiArgsEntry {
  args: string[];
  createdAt: number;
}

const TTL_MS = 60 * 1000;

export class RofiArgsCache {
  private entries = new Map<string, RofiArgsEntry>();

  get(key: string): string[] | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > TTL_MS) {
      this.entries.delete(key);
      return null;
    }
    return entry.args;
  }

  set(key: string, args: string[]): void {
    this.entries.set(key, { args, createdAt: Date.now() });
  }

  invalidate(): void {
    this.entries.clear();
  }
}
