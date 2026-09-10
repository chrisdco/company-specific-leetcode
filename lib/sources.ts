import { parse } from "csv-parse/sync";
import type { Problem } from "@/app/types/problem";

// ---------------------------------------------------------------------------
// Multi-source adapter: liquidslr (primary) + snehasishroy (fallback)
// ---------------------------------------------------------------------------

export type DataSource = "primary" | "fallback";

const PRIMARY_TIME_TO_FILE: Record<string, string> = {
  "Thirty Days": "1. Thirty Days.csv",
  "Three Months": "2. Three Months.csv",
  "Six Months": "3. Six Months.csv",
  "More Than Six Months": "4. More Than Six Months.csv",
  All: "5. All.csv",
};

const FALLBACK_TIME_TO_FILE: Record<string, string> = {
  "Thirty Days": "thirty-days.csv",
  "Three Months": "three-months.csv",
  "Six Months": "six-months.csv",
  "More Than Six Months": "more-than-six-months.csv",
  All: "all.csv",
};

const PRIMARY_ROOT =
  "https://api.github.com/repos/liquidslr/leetcode-company-wise-problems/contents/";
const FALLBACK_ROOT =
  "https://api.github.com/repos/snehasishroy/leetcode-companywise-interview-questions/contents/";
const PRIMARY_RAW =
  "https://raw.githubusercontent.com/liquidslr/leetcode-company-wise-problems/main";
const FALLBACK_RAW =
  "https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_CSV_BYTES = 2_500_000; // 2.5MB safety cap
// Company directories change rarely (new listings, renames) — a week is safe
// and keeps cold starts cheap. Problem CSVs refresh with upstream's manual
// updates (~monthly), so 6h stays honest while slashing repeat origin load.
const COMPANY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROBLEMS_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expires: number;
}

// globalThis cache survives HMR / route reuse in dev
const globalCache = globalThis as unknown as {
  __cslCache?: Map<string, CacheEntry<unknown>>;
};
function cache(): Map<string, CacheEntry<unknown>> {
  if (!globalCache.__cslCache) globalCache.__cslCache = new Map();
  return globalCache.__cslCache;
}
function getCached<T>(key: string): T | null {
  const e = cache().get(key) as CacheEntry<T> | undefined;
  if (!e) return null;
  if (Date.now() > e.expires) {
    cache().delete(key);
    return null;
  }
  return e.value;
}
function setCached<T>(key: string, value: T, ttl: number) {
  cache().set(key, { value, expires: Date.now() + ttl });
}

// Coalesce concurrent identical fetches: without this, N simultaneous cold
// starts (or one multi-company load) fire N duplicate upstream requests.
// No env/token needed — purely a thundering-herd guard.
const inflight = new Map<string, Promise<unknown>>();
function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "company-leetcode-app",
      ...(init?.headers as Record<string, string> | undefined),
    };
    const res = await fetch(url, {
      ...init,
      headers,
      signal: ctrl.signal,
      next: { revalidate: 86400 },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

interface GitHubContent {
  name: string;
  type: string;
}

/** Thrown for HTTP 403/429 from api.github.com, carrying a retry hint. */
export class RateLimitedError extends Error {
  readonly status: number;
  readonly retryAfterSecs: number | null;
  constructor(message: string, opts: { status: number; retryAfterSecs?: number | null }) {
    super(message);
    this.name = "RateLimitedError";
    this.status = opts.status;
    this.retryAfterSecs = opts.retryAfterSecs ?? null;
  }
}

/** Prefer an explicit Retry-After; else derive from x-ratelimit-reset epoch. */
function parseRetryAfter(res: Response): number | null {
  const ra = res.headers.get("retry-after");
  if (ra !== null) {
    const s = parseInt(ra, 10);
    if (Number.isFinite(s) && s >= 0) return s;
  }
  const reset = res.headers.get("x-ratelimit-reset");
  if (reset !== null) {
    const epoch = parseInt(reset, 10);
    if (Number.isFinite(epoch)) {
      return Math.max(0, epoch - Math.floor(Date.now() / 1000));
    }
  }
  return null;
}

function toRateLimitedError(res: Response): RateLimitedError {
  const secs = parseRetryAfter(res);
  const when =
    secs !== null && secs > 0 ? ` — retry in ~${Math.ceil(secs / 60)} min` : "";
  return new RateLimitedError(`GitHub API rate limit reached${when}.`, {
    status: res.status,
    retryAfterSecs: secs,
  });
}

interface ETagEntry {
  etag: string;
  body: unknown;
}

// ETag store for conditional requests. Revalidated api.github.com responses
// come back 304 and cost ZERO quota (vs 1 call per 200) — the cheapest
// rate-limit insurance available without credentials or shared storage.
const etagCache = new Map<string, ETagEntry>();

/**
 * JSON GET against api.github.com following current best practice:
 * versioned Accept header, conditional requests via ETag, and explicit
 * rate-limit errors instead of opaque 403s.
 */
export async function fetchGitHubJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "company-leetcode-app",
  };
  const prev = etagCache.get(url);
  if (prev) headers["If-None-Match"] = prev.etag;
  const res = await fetchWithTimeout(url, { headers });
  if (res.status === 304 && prev) return prev.body as T;
  if (res.status === 403 || res.status === 429) throw toRateLimitedError(res);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = (await res.json()) as T;
  const etag = res.headers.get("etag");
  if (etag) etagCache.set(url, { etag, body });
  return body;
}

async function fetchDirNames(apiUrl: string): Promise<string[]> {
  return dedup(`dirs:${apiUrl}`, async () => {
    const data = await fetchGitHubJson<GitHubContent[]>(apiUrl);
    if (!Array.isArray(data)) return [];
    return data.filter((d) => d.type === "dir").map((d) => d.name);
  });
}

/** strip to alphanumerics for fuzzy cross-source matching */
export function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "aqr-capital-management" -> "Aqr Capital Management", "jpmorgan" -> "Jpmorgan" */
export function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** liquidslr "Amazon" -> snehasishroy slug guess */
export function toFallbackSlug(company: string): string {
  return company
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/&/g, "and")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeDifficulty(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "easy") return "Easy";
  if (s === "medium" || s === "med") return "Medium";
  if (s === "hard") return "Hard";
  return "Unknown";
}

/** Primary stores "100.0" (0-100, no %). Fallback stores "100.0%". -> "100.0" */
export function normalizeFrequency(raw: unknown): string {
  const s = String(raw ?? "").trim().replace("%", "");
  let n = parseFloat(s);
  if (!Number.isFinite(n)) return "0";
  if (n > 0 && n <= 1) n = n * 100; // just in case a fraction slips through
  n = Math.min(100, Math.max(0, n));
  return String(Math.round(n * 10) / 10);
}

/**
 * Upstream primary currently stores acceptance ~100x too small
 * (e.g. Two Sum "0.0058" instead of ~58%). Fallback stores correct "57.8%".
 * Heuristic: parse number; if it already has % keep scale; fractions get x100;
 * if result is still <2% it was double-divided, x100 again.
 */
export function normalizeAcceptance(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "N/A";
  if (s.toUpperCase() === "N/A" || s === "-") return "N/A";
  const hadPercent = s.includes("%");
  let n = parseFloat(s.replace("%", ""));
  if (!Number.isFinite(n)) return "N/A";
  if (!hadPercent && n > 0 && n <= 1) n = n * 100;
  if (n > 0 && n < 2) n = n * 100; // repair double-divided upstream values
  n = Math.min(100, Math.max(0, n));
  return `${Math.round(n * 10) / 10}%`;
}

export function isValidLeetCodeLink(link: string): boolean {
  return /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/?(\?.*)?$/i.test(
    link.trim()
  );
}

export function normalizeTopics(raw: unknown): string[] {  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s
    .split(/[;|]/)
    .flatMap((part) => part.split(","))
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function getMergedCompanyList(): Promise<{
  companies: string[];
  primaryCount: number;
  fallbackCount: number;
}> {  const cached = getCached<{ companies: string[]; primaryCount: number; fallbackCount: number }>(
    "companies-merged"
  );
  if (cached) return cached;

  // Degrade gracefully: serve whichever source answered. But if NOTHING
  // answered *because of rate limiting* (as opposed to network failure),
  // propagate that signal so routes can answer 429 with a Retry-After hint
  // instead of a misleading generic 502.
  let rateLimited: RateLimitedError | null = null;
  const guard = (p: Promise<string[]>) =>
    p.catch((e: unknown) => {
      if (e instanceof RateLimitedError && !rateLimited) rateLimited = e;
      return [] as string[];
    });
  const [primary, fallback] = await Promise.all([
    guard(fetchDirNames(PRIMARY_ROOT)),
    guard(fetchDirNames(FALLBACK_ROOT)),
  ]);

  if (primary.length === 0 && fallback.length === 0) {
    if (rateLimited) throw rateLimited;
    throw new Error("Both upstream sources are unreachable (GitHub API rate limit or network).");
  }

  const seen = new Map<string, string>(); // normalizeKey -> display name (prefer primary casing)
  for (const name of primary) {
    const k = normalizeKey(name);
    if (!seen.has(k)) seen.set(k, name);
  }
  for (const slug of fallback) {
    const k = normalizeKey(slug);
    if (!seen.has(k)) seen.set(k, prettifySlug(slug));
  }
  const companies = [...seen.values()].sort((a, b) => a.localeCompare(b));
  const result = { companies, primaryCount: primary.length, fallbackCount: fallback.length };
  setCached("companies-merged", result, COMPANY_TTL_MS);
  return result;
}

export interface UpstreamFreshness {
  primary: string | null;
  fallback: string | null;
}

/** Latest upstream commit dates (ISO) so the UI can show a real "data as of" date. */
export async function getUpstreamFreshness(): Promise<UpstreamFreshness> {
  const cached = getCached<UpstreamFreshness>("upstream-freshness");
  if (cached) return cached;
  const pick = (json: unknown): string | null => {
    if (!Array.isArray(json) || json.length === 0) return null;
    const c = (json[0] as { commit?: { committer?: { date?: string }; author?: { date?: string } } })?.commit;
    return c?.committer?.date ?? c?.author?.date ?? null;
  };
  try {
    const fetchLatest = (repo: string) =>
      dedup(`commits:${repo}`, () =>
        fetchGitHubJson<unknown>(`https://api.github.com/repos/${repo}/commits?per_page=1`).catch(() => null)
      );
    const [p, f] = await Promise.all([
      fetchLatest("liquidslr/leetcode-company-wise-problems"),
      fetchLatest("snehasishroy/leetcode-companywise-interview-questions"),
    ]);
    const result = { primary: pick(p), fallback: pick(f) };
    setCached("upstream-freshness", result, COMPANY_TTL_MS);
    return result;
  } catch {
    return { primary: null, fallback: null };
  }
}

/** Resolve a canonical company name to a fallback slug via fuzzy match. */
async function resolveFallbackSlug(company: string): Promise<string | null> {
  const cached = getCached<string[]>("fallback-dirs");
  let dirs = cached;
  if (!dirs) {
    try {
      dirs = await fetchDirNames(FALLBACK_ROOT);
      setCached("fallback-dirs", dirs, COMPANY_TTL_MS);
    } catch {
      return toFallbackSlug(company);
    }
  }
  const target = normalizeKey(company);
  const exact = dirs.find((d) => normalizeKey(d) === target);
  if (exact) return exact;
  // loose: slug guess must exist verbatim
  const guess = toFallbackSlug(company);
  if (dirs.includes(guess)) return guess;
  return null;
}

async function fetchCsvText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "text/csv,text/plain,*/*" } as unknown as Record<string, string>,
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  // size guard: check header first, then body length
  const len = res.headers.get("content-length");
  if (len && parseInt(len, 10) > MAX_CSV_BYTES) throw new Error("CSV too large");
  const text = await res.text();
  if (text.length > MAX_CSV_BYTES) throw new Error("CSV too large");
  if (!text.trim()) throw new Error("Empty CSV");
  return text;
}

export function parsePrimaryCsv(csv: string, company: string): Problem[] {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  const out: Problem[] = [];
  for (const r of records) {
    const title = (r["Title"] ?? "").trim();
    const link = (r["Link"] ?? "").trim();
    if (!title || !link || !isValidLeetCodeLink(link)) continue;
    out.push({
      Company: company,
      Difficulty: normalizeDifficulty(r["Difficulty"]),
      Title: title,
      Frequency: normalizeFrequency(r["Frequency"]),
      "Acceptance Rate": normalizeAcceptance(r["Acceptance Rate"]),
      Link: link,
      Topics: normalizeTopics(r["Topics"]),
    });
  }
  return out;
}

export function parseFallbackCsv(csv: string, company: string): Problem[] {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  const out: Problem[] = [];
  for (const r of records) {
    const title = (r["Title"] ?? "").trim();
    const link = (r["URL"] ?? r["Link"] ?? "").trim();
    if (!title || !link || !isValidLeetCodeLink(link)) continue;
    out.push({
      Company: company,
      Difficulty: normalizeDifficulty(r["Difficulty"]),
      Title: title,
      Frequency: normalizeFrequency(r["Frequency %"] ?? r["Frequency"]),
      "Acceptance Rate": normalizeAcceptance(r["Acceptance %"] ?? r["Acceptance Rate"]),
      Link: link,
      Topics: [], // fallback source has no topic column
    });
  }
  return out;
}

export async function getProblemsWithFallback(
  company: string,
  time: string
): Promise<{ problems: Problem[]; source: DataSource; fallbackUsed: boolean }> {
  const cacheKey = `problems:${company}:${time}`;
  const cached = getCached<{ problems: Problem[]; source: DataSource; fallbackUsed: boolean }>(
    cacheKey
  );
  if (cached) return cached;

  const primaryFile = PRIMARY_TIME_TO_FILE[time];
  if (primaryFile) {
    try {
      const url = `${PRIMARY_RAW}/${encodeURIComponent(company)}/${encodeURIComponent(primaryFile)}`;
      const csv = await fetchCsvText(url);
      const problems = parsePrimaryCsv(csv, company);
      if (problems.length > 0) {
        const result = { problems, source: "primary" as DataSource, fallbackUsed: false };
        setCached(cacheKey, result, PROBLEMS_TTL_MS);
        return result;
      }
      // empty parse -> fall through to fallback
    } catch {
      // fall through to fallback
    }
  }

  const fallbackFile = FALLBACK_TIME_TO_FILE[time];
  if (!fallbackFile) throw new Error("Invalid time period");
  const slug = await resolveFallbackSlug(company);
  if (!slug) throw new Error("Company not found in either source");
  const url = `${FALLBACK_RAW}/${encodeURIComponent(slug)}/${encodeURIComponent(fallbackFile)}`;
  const csv = await fetchCsvText(url);
  const problems = parseFallbackCsv(csv, company);
  // Don't cache empty results: an empty parse (or a partially-synced upstream
  // folder) should be retried next time instead of served stale for an hour.
  if (problems.length === 0) {
    return { problems, source: "fallback" as DataSource, fallbackUsed: true };
  }
  const result = { problems, source: "fallback" as DataSource, fallbackUsed: true };
  setCached(cacheKey, result, PROBLEMS_TTL_MS);
  return result;
}
