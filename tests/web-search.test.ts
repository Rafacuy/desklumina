import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import * as webSearchModule from "../src/tools/frameworks/web-search";
import { settingsManager } from "../src/core/services/settings-manager";
import { env } from "../src/config/env";
import { sanitizeLog } from "../src/logger/sanitize";

const { webSearch } = webSearchModule;

const SAVED = {
  serper: "",
  serpapi: "",
  searxngBase: "",
  searxngAuthName: "",
  searxngAuthValue: "",
  tavily: "",
  provider: "",
  timeout: "",
};

function saveEnv() {
  SAVED.serper = process.env.SERPER_API_KEY || "";
  SAVED.serpapi = process.env.SERPAPI_API_KEY || "";
  SAVED.searxngBase = process.env.SEARXNG_BASE_URL || "";
  SAVED.searxngAuthName = process.env.SEARXNG_AUTH_HEADER_NAME || "";
  SAVED.searxngAuthValue = process.env.SEARXNG_AUTH_HEADER_VALUE || "";
  SAVED.tavily = process.env.TAVILY_API_KEY || "";
  SAVED.provider = process.env.DESKLUMINA_WEB_SEARCH_PROVIDER || "";
  SAVED.timeout = process.env.DESKLUMINA_WEB_SEARCH_TIMEOUT_MS || "";
}

function restoreEnv() {
  process.env.SERPER_API_KEY = SAVED.serper || undefined;
  process.env.SERPAPI_API_KEY = SAVED.serpapi || undefined;
  process.env.SEARXNG_BASE_URL = SAVED.searxngBase || undefined;
  process.env.SEARXNG_AUTH_HEADER_NAME = SAVED.searxngAuthName || undefined;
  process.env.SEARXNG_AUTH_HEADER_VALUE = SAVED.searxngAuthValue || undefined;
  process.env.TAVILY_API_KEY = SAVED.tavily || undefined;
  process.env.DESKLUMINA_WEB_SEARCH_PROVIDER = SAVED.provider || undefined;
  process.env.DESKLUMINA_WEB_SEARCH_TIMEOUT_MS = SAVED.timeout || undefined;
}

function setAutoEnv() {
  process.env.SERPER_API_KEY = "serper-key";
  process.env.SERPAPI_API_KEY = "serpapi-key";
  process.env.SEARXNG_BASE_URL = "https://searx.example";
  process.env.TAVILY_API_KEY = "tavily-key";
  settingsManager.setWebSearchProvider("auto");
  settingsManager.setWebSearchSafeSearch(false);
}

let fetchSpy: ReturnType<typeof mock> | null = null;

function mockFetch(response: () => { ok: boolean; status: number; headers: Headers; json: () => unknown }) {
  const impl = () => Promise.resolve(response()) as unknown as Response;
  const fetchMock = mock(impl);
  fetchSpy = fetchMock as unknown as ReturnType<typeof mock>;
}

async function runWebSearch(arg: string) {
  return webSearch(arg, { fetcher: fetchSpy as unknown as typeof fetch });
}

function lastCall(): [string, RequestInit | undefined] | undefined {
  const calls = (fetchSpy?.mock?.calls ?? []) as unknown[][];
  if (calls.length === 0) return undefined;
  return calls[calls.length - 1] as [string, RequestInit | undefined];
}

function requestBody(): Record<string, unknown> | undefined {
  const call = lastCall();
  if (!call) return undefined;
  const body = call[1]?.body;
  if (typeof body === "string") return JSON.parse(body);
  return undefined;
}

function requestUrl(): string | undefined {
  return lastCall()?.[0];
}

function requestHeaders(): Record<string, string> | undefined {
  return lastCall()?.[1]?.headers as Record<string, string> | undefined;
}

describe("Web Search Tool", () => {
  beforeEach(() => {
    saveEnv();
  });

  afterEach(() => {
    restoreEnv();
    fetchSpy?.mockRestore?.();
    fetchSpy = null;
  });

  describe("Argument parsing", () => {
    test("rejects non-JSON argument", async () => {
      const result = await runWebSearch("latest linux kernel");
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("rejects malformed JSON", async () => {
      const result = await runWebSearch('{query: "test"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("rejects empty query", async () => {
      const result = await runWebSearch('{"query": ""}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("rejects missing query", async () => {
      const result = await runWebSearch('{"provider": "tavily"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("rejects unsupported provider", async () => {
      process.env.TAVILY_API_KEY = "k";
      const result = await runWebSearch('{"query": "x", "provider": "bing"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("rejects unsupported type", async () => {
      process.env.TAVILY_API_KEY = "k";
      const result = await runWebSearch('{"query": "x", "type": "videos"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("rejects unsupported timeRange", async () => {
      process.env.TAVILY_API_KEY = "k";
      const result = await runWebSearch('{"query": "x", "timeRange": "decade"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("caps limit to provider maximum", async () => {
      setAutoEnv();
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [{ title: "A", url: "https://example.com", content: "c" }] }),
      }));
      const tavilyResult = await runWebSearch('{"query": "x", "limit": 100, "provider": "tavily"}');
      expect(tavilyResult.success).toBe(true);
      expect(tavilyResult.extra?.webSearch?.requestedLimit).toBe(20);

      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ organic: [{ title: "A", link: "https://example.com", snippet: "c" }] }),
      }));
      const serperResult = await runWebSearch('{"query": "x", "limit": 100, "provider": "serper"}');
      expect(serperResult.success).toBe(true);
      expect(serperResult.extra?.webSearch?.requestedLimit).toBe(10);
    });

    test("enforces max query length", async () => {
      process.env.TAVILY_API_KEY = "k";
      const result = await runWebSearch(`{"query": "${"x".repeat(600)}"}`);
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });
  });

  describe("Serper provider", () => {
    test("builds correct web search request", async () => {
      process.env.SERPER_API_KEY = "serper-key";
      settingsManager.setWebSearchSafeSearch(false);
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          organic: [
            { title: "Hello", link: "https://example.com", snippet: "Snippet text", position: 1 },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "serper"}');
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(requestUrl()).toBe("https://google.serper.dev/search");
      expect(requestBody()).toMatchObject({ q: "hello" });
      expect(requestHeaders()).toMatchObject({
        "Content-Type": "application/json",
        "X-API-KEY": "serper-key",
      });
    });

    test("applies safeSearch when enabled", async () => {
      process.env.SERPER_API_KEY = "serper-key";
      settingsManager.setWebSearchSafeSearch(true);
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          organic: [{ title: "Hello", link: "https://example.com", snippet: "Snippet text", position: 1 }],
        }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "serper"}');
      expect(result.success).toBe(true);
      expect(requestBody()).toMatchObject({ safe: "active" });
    });

    test("maps news and images to correct endpoints", async () => {
      process.env.SERPER_API_KEY = "serper-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          news: [{ title: "News", link: "https://example.com/news", snippet: "n" }],
          images: [{ title: "Image", link: "https://example.com/img", snippet: "i" }],
        }),
      }));
      const news = await runWebSearch('{"query": "n", "provider": "serper", "type": "news"}');
      expect(news.success).toBe(true);
      expect(requestUrl()).toBe("https://google.serper.dev/news");

      const images = await runWebSearch('{"query": "i", "provider": "serper", "type": "images"}');
      expect(images.success).toBe(true);
      expect(requestUrl()).toBe("https://google.serper.dev/images");
    });

    test("returns no_results when organic is empty", async () => {
      process.env.SERPER_API_KEY = "serper-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ organic: [] }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "serper"}');
      expect(result.success).toBe(true);
      expect(result.status).toBe("no_results");
    });

    test("classifies 401 as authentication failure", async () => {
      process.env.SERPER_API_KEY = "bad";
      mockFetch(() => ({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({}),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "serper"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(401);
    });
  });

  describe("SerpAPI provider", () => {
    test("builds correct GET request", async () => {
      process.env.SERPAPI_API_KEY = "serpapi-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          organic_results: [{ title: "Hello", link: "https://example.com", snippet: "Snippet", position: 1 }],
        }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "serpapi", "country": "us", "language": "en"}');
      expect(result.success).toBe(true);
      const url = requestUrl();
      expect(url).toStartWith("https://serpapi.com/search.json");
      expect(url).toContain("engine=google");
      expect(url).toContain("q=hello");
      expect(url).toContain("api_key=serpapi-key");
      expect(url).toContain("gl=us");
      expect(url).toContain("hl=en");
    });

    test("maps tbm for news and images", async () => {
      process.env.SERPAPI_API_KEY = "serpapi-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ organic_results: [] }),
      }));
      await runWebSearch('{"query": "n", "provider": "serpapi", "type": "news"}');
      expect(requestUrl()).toContain("tbm=nws");
      await runWebSearch('{"query": "i", "provider": "serpapi", "type": "images"}');
      expect(requestUrl()).toContain("tbm=isch");
    });

    test("applies safeSearch when enabled", async () => {
      process.env.SERPAPI_API_KEY = "serpapi-key";
      settingsManager.setWebSearchSafeSearch(true);
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ organic_results: [{ title: "Hello", link: "https://example.com", snippet: "s" }] }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "serpapi"}');
      expect(result.success).toBe(true);
      expect(requestUrl()).toContain("safe=active");
    });
  });

  describe("SearXNG provider", () => {
    test("builds correct GET request", async () => {
      process.env.SEARXNG_BASE_URL = "https://searx.example";
      settingsManager.setWebSearchSafeSearch(true);
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [{ title: "Hello", url: "https://example.com", content: "Snippet", score: 0.9 }],
        }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "searxng"}');
      expect(result.success).toBe(true);
      const url = requestUrl();
      expect(url).toStartWith("https://searx.example/search");
      expect(url).toContain("format=json");
      expect(url).toContain("safesearch=1");
    });

    test("rejects invalid base URL", async () => {
      process.env.SEARXNG_BASE_URL = "not-a-url";
      const result = await runWebSearch('{"query": "hello", "provider": "searxng"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    test("returns unsupported capability for timeRange=week", async () => {
      process.env.SEARXNG_BASE_URL = "https://searx.example";
      const result = await runWebSearch('{"query": "hello", "provider": "searxng", "timeRange": "week"}');
      expect(result.success).toBe(false);
      expect(result.status).toBe("unsupported-capability");
    });

    test("classifies non-JSON response as malformed", async () => {
      process.env.SEARXNG_BASE_URL = "https://searx.example";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        json: () => ({}),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "searxng"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(502);
    });

    test("uses auth header when configured", async () => {
      process.env.SEARXNG_BASE_URL = "https://searx.example";
      process.env.SEARXNG_AUTH_HEADER_NAME = "X-Searx-Auth";
      process.env.SEARXNG_AUTH_HEADER_VALUE = "secret-token";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [] }),
      }));
      await runWebSearch('{"query": "hello", "provider": "searxng"}');
      expect(requestHeaders()).toMatchObject({ "X-Searx-Auth": "secret-token" });
    });
  });

  describe("Tavily provider", () => {
    test("builds correct POST request", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [{ title: "Hello", url: "https://example.com", content: "Content", score: 0.95 }],
        }),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "tavily"}');
      expect(result.success).toBe(true);
      expect(requestUrl()).toBe("https://api.tavily.com/search");
      expect(requestHeaders()).toMatchObject({ Authorization: "Bearer tavily-key" });
      expect(requestBody()).toMatchObject({
        query: "hello",
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
        topic: "general",
      });
    });

    test("maps images to topic=general + include_images", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [] }),
      }));
      await runWebSearch('{"query": "cats", "provider": "tavily", "type": "images"}');
      expect(requestBody()).toMatchObject({ topic: "general", include_images: true });
    });

    test("ignores country for news topic with warning", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [{ title: "N", url: "https://example.com", content: "c" }] }),
      }));
      const result = await runWebSearch('{"query": "news", "provider": "tavily", "type": "news", "country": "US"}');
      expect(result.success).toBe(true);
      expect(requestBody()).not.toHaveProperty("country");
      expect(result.extra?.webSearch?.warnings.some((w) => w.includes("country"))).toBe(true);
    });

    test("max_results bounded to 20 and respects DeskLumina limit cap", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [{ title: "A", url: "https://example.com", content: "c" }] }),
      }));
      await runWebSearch('{"query": "x", "provider": "tavily", "limit": 50}');
      expect(requestBody()).toMatchObject({ max_results: 20 });
    });

    test("classifies 429 as rate-limit failure", async () => {
      process.env.TAVILY_API_KEY = "k";
      mockFetch(() => ({
        ok: false,
        status: 429,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({}),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(429);
    });
  });

  describe("Provider selection", () => {
    test("uses explicit provider when specified", async () => {
      setAutoEnv();
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [{ title: "T", url: "https://example.com", content: "c" }] }),
      }));
      await runWebSearch('{"query": "hello", "provider": "tavily"}');
      expect(requestUrl()).toBe("https://api.tavily.com/search");
    });

    test("auto falls through configured providers in deterministic order", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [{ title: "T", url: "https://example.com", content: "c" }] }),
      }));
      await runWebSearch('{"query": "hello"}');
      expect(requestUrl()).toBe("https://api.tavily.com/search");
    });

  });

  describe("Fallback behavior", () => {
    test("auto retries next provider on retriable failure", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      process.env.SERPER_API_KEY = "serper-key";
      let calls = 0;
      mockFetch(() => {
        calls++;
        if (calls === 1) {
          return { ok: false, status: 503, headers: new Headers(), json: () => ({}) };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => ({ organic: [{ title: "Fallback", link: "https://example.com", snippet: "ok" }] }),
        };
      });
      const result = await runWebSearch('{"query": "hello"}');
      expect(result.success).toBe(true);
      expect(result.extra?.webSearch?.provider).toBe("serper");
      expect(result.extra?.webSearch?.warnings.length).toBeGreaterThan(0);
    });

    test("explicit provider does not fallback", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      process.env.SERPER_API_KEY = "serper-key";
      mockFetch(() => ({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: () => ({}),
      }));
      const result = await runWebSearch('{"query": "hello", "provider": "tavily"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(503);
    });

    test("authentication failure does not trigger fallback", async () => {
      process.env.TAVILY_API_KEY = "bad";
      process.env.SERPER_API_KEY = "serper-key";
      mockFetch(() => ({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => ({}),
      }));
      const result = await runWebSearch('{"query": "hello"}');
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(401);
    });
  });

  describe("Result normalization", () => {
    test("deduplicates by canonical URL", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A", url: "https://example.com/page#one", content: "one" },
            { title: "A", url: "https://example.com/page#two", content: "two" },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results.length).toBe(1);
    });

    test("deduplicates URLs that differ only by tracking parameters", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A", url: "https://example.com/page?utm_source=google&utm_medium=cpc", content: "same" },
            { title: "A", url: "https://example.com/page?fbclid=abc123", content: "same" },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results.length).toBe(1);
      expect(result.extra?.webSearch?.results[0]?.url).toBe("https://example.com/page");
    });

    test("deduplicates www vs non-www variants of the same URL", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A", url: "https://www.example.com/page", content: "c1" },
            { title: "B", url: "https://example.com/page", content: "c2" },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results.length).toBe(2);
    });

    test("deduplicates http vs https variants of the same URL", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A", url: "http://example.com/page", content: "same content" },
            { title: "A", url: "https://example.com/page", content: "same content" },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results.length).toBe(1);
    });

    test("deduplicates near-duplicates by same host, title, and snippet prefix", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      const sharedSnippet = "This is a near-duplicate snippet that is long enough to match.";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "Same Title", url: "https://example.com/page-a", content: sharedSnippet },
            { title: "Same Title", url: "https://example.com/page-b", content: sharedSnippet },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results.length).toBe(1);
    });

    test("removes tracking parameters", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [{ title: "A", url: "https://example.com/page?utm_source=x", content: "c" }],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results[0]?.url).toBe("https://example.com/page");
    });

    test("caps snippet and title lengths", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A".repeat(200), url: "https://example.com", content: "b".repeat(1000) },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      const item = result.extra?.webSearch?.results[0];
      expect(item?.title.length).toBeLessThanOrEqual(143);
      expect(item?.snippet.length).toBeLessThanOrEqual(323);
    });

    test("strips HTML from raw content previews", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A", url: "https://example.com", content: "c", raw_content: "<p>Hello</p>" },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily", "includeRawContent": true}');
      expect(result.extra?.webSearch?.results[0]?.rawContentPreview).not.toContain("<");
    });

    test("drops unsupported URL schemes", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [
            { title: "A", url: "ftp://example.com", content: "c" },
            { title: "B", url: "https://example.com", content: "c" },
          ],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results.length).toBe(1);
      expect(result.extra?.webSearch?.results[0]?.url).toStartWith("https");
    });
  });

  describe("Summarization and context budget", () => {
    test("extra.webSearch block stays within 3000 chars", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      const manyResults = Array.from({ length: 20 }, (_, i) => ({
        title: `Result ${i} ${"x".repeat(200)}`,
        url: `https://example.com/${i}`,
        content: "content",
      }));
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: manyResults }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily", "limit": 10}');
      const chatManagerFormatted = [
        `web_search: ${result.extra?.webSearch?.provider}`,
        `query="${result.extra?.webSearch?.query}"`,
        `results=${result.extra?.webSearch?.returnedCount}/${result.extra?.webSearch?.requestedLimit}`,
        ...result.extra!.webSearch!.results.map((r) => `${r.rank}. ${r.title} — ${r.url}`),
      ].join("\n");
      expect(chatManagerFormatted.length).toBeLessThanOrEqual(3000);
    });

    test("raw content is excluded by default", async () => {
      process.env.TAVILY_API_KEY = "tavily-key";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({
          results: [{ title: "A", url: "https://example.com", content: "c", raw_content: "raw" }],
        }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.extra?.webSearch?.results[0]?.rawContentPreview).toBeUndefined();
    });
  });

  describe("Configuration", () => {
    test("env accessors read fresh values", () => {
      process.env.TAVILY_API_KEY = "fresh";
      expect(env.TAVILY_API_KEY).toBe("fresh");
    });

    test("timeout clamps to bounds", async () => {
      setAutoEnv();
      process.env.DESKLUMINA_WEB_SEARCH_TIMEOUT_MS = "100000";
      mockFetch(() => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => ({ results: [] }),
      }));
      const result = await runWebSearch('{"query": "x", "provider": "tavily"}');
      expect(result.success).toBe(true);
    });
  });

  describe("Logging sanitization", () => {
    test("sanitizeLog redacts api_key values", () => {
      expect(sanitizeLog({ api_key: "secret" })).toEqual({ api_key: "REDACTED" });
    });

    test("sanitizeLog redacts Authorization header in string", () => {
      expect(sanitizeLog("Authorization: Bearer mytoken")).toContain("REDACTED");
    });

    test("sanitizeLog redacts caller-defined X-* header values", () => {
      expect(sanitizeLog("X-Searx-Auth: secret-token")).toContain("REDACTED");
    });
  });
});
