const TRACKING_PREFIXES = ["utm_", "fbclid", "gclid"];
const TRACKING_EXACT = new Set(["ref", "source"]);

// strips tracking crud, drops non-http(s) stuff. 
// returns null if it garbage
export function normalizeUrl(url: string): { url: string; scheme: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    u.username = "";
    u.password = "";
    const keysToDelete: string[] = [];
    u.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PREFIXES.some((p) => lower.startsWith(p)) || TRACKING_EXACT.has(lower)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) u.searchParams.delete(key);
    u.hash = ""; // bye hash
    return { url: u.toString(), scheme: u.protocol };
  } catch {
    return null; 
  }
}

// for dedup. same url with different trailing slashes = same key. falls back to lowercasing if parse dies
export function canonicalUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return `${u.protocol.toLowerCase()}//${u.hostname.toLowerCase()}${u.pathname}`.replace(
      /\/+$/,
      ""
    );
  } catch {
    return url.toLowerCase(); // keep simple
  }
}

// "www.example.com" -> "example.com". or "" if its busted
export function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
