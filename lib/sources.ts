import { parse } from "csv-parse/sync";
import type { Problem } from "@/app/types/problem";

// ---------------------------------------------------------------------------
// Multi-source adapter: liquidslr (primary) + snehasishroy (fallback)
// ---------------------------------------------------------------------------

export type DataSource = "primary" | "fallback";

export const TIME_OPTIONS = [
  "Thirty Days",
  "Three Months",
  "Six Months",
  "More Than Six Months",
  "All",
] as const;

export type TimeOption = (typeof TIME_OPTIONS)[number];

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
const COMPANY_TTL_MS = 24 * 60 * 60 * 1000;
const PROBLEMS_TTL_MS = 60 * 60 * 1000;

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

async function fetchDirNames(apiUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(apiUrl);
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = (await res.json()) as GitHubContent[];
  if (!Array.isArray(data)) return [];
  return data.filter((d) => d.type === "dir").map((d) => d.name);
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

function normalizeTopics(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
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
}> {
  const cached = getCached<{ companies: string[]; primaryCount: number; fallbackCount: number }>(
    "companies-merged"
  );
  if (cached) return cached;

  const [primary, fallback] = await Promise.all([
    fetchDirNames(PRIMARY_ROOT).catch(() => [] as string[]),
    fetchDirNames(FALLBACK_ROOT).catch(() => [] as string[]),
  ]);

  if (primary.length === 0 && fallback.length === 0) {
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

function parsePrimaryCsv(csv: string, company: string): Problem[] {
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

function parseFallbackCsv(csv: string, company: string): Problem[] {
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
  const result = { problems, source: "fallback" as DataSource, fallbackUsed: true };
  setCached(cacheKey, result, PROBLEMS_TTL_MS);
  return result;
}
