import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGitHubJson, RateLimitedError } from "./sources";
import { TIME_OPTIONS } from "./constants";

const BASE = "https://api.github.com/test/call-tuning";

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (u: unknown, init?: unknown) => handler(u as string, init as RequestInit))
  );
}

function headersOf(init?: RequestInit): Record<string, string> {
  return ((init?.headers ?? {}) as Record<string, string>);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchGitHubJson headers", () => {
  it("sends the versioned Accept header and API version", async () => {
    let seen: Record<string, string> = {};
    stubFetch((_u, init) => {
      seen = headersOf(init);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { etag: '"h1"' },
      });
    });
    await fetchGitHubJson(`${BASE}#headers`);
    expect(seen["Accept"]).toBe("application/vnd.github+json");
    expect(seen["X-GitHub-Api-Version"]).toBe("2022-11-28");
    expect(seen["User-Agent"]).toBe("company-leetcode-app");
  });
});

describe("fetchGitHubJson ETags", () => {
  it("revalidates and serves the cached body on 304 without re-parsing", async () => {
    const u = `${BASE}#etag`;
    let calls = 0;
    stubFetch((_url, init) => {
      calls++;
      if (headersOf(init)["If-None-Match"] === '"e1"') {
        return new Response(null, { status: 304 });
      }
      return new Response(JSON.stringify(["x"]), {
        status: 200,
        headers: { etag: '"e1"' },
      });
    });
    const first = await fetchGitHubJson<string[]>(u);
    const second = await fetchGitHubJson<string[]>(u);
    expect(first).toEqual(["x"]);
    expect(second).toBe(first);
    expect(calls).toBe(2);
  });
});

describe("fetchGitHubJson rate limits", () => {
  it("derives wait minutes from x-ratelimit-reset", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600;
    stubFetch(
      () => new Response("{}", { status: 403, headers: { "x-ratelimit-reset": String(reset) } })
    );
    const err = (await fetchGitHubJson(`${BASE}#rl1`).catch((e) => e)) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.retryAfterSecs).toBeGreaterThan(590);
    expect(err.retryAfterSecs).toBeLessThanOrEqual(600);
    expect(err.message).toMatch(/retry in ~10 min/);
  });

  it("prefers an explicit Retry-After header", async () => {
    stubFetch(() => new Response("{}", { status: 429, headers: { "retry-after": "120" } }));
    const err = (await fetchGitHubJson(`${BASE}#rl2`).catch((e) => e)) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.retryAfterSecs).toBe(120);
    expect(err.message).toMatch(/retry in ~2 min/);
  });

  it("throws plain errors for other failures", async () => {
    stubFetch(() => new Response("boom", { status: 500 }));
    await expect(fetchGitHubJson(`${BASE}#rl3`)).rejects.toThrow("GitHub API 500");
  });
});

describe("shared constants", () => {
  it("TIME_OPTIONS covers all five windows", () => {
    expect(TIME_OPTIONS).toHaveLength(5);
    expect(TIME_OPTIONS).toContain("All");
    expect(TIME_OPTIONS).toContain("Thirty Days");
  });
});
