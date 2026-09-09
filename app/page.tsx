"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProblemTable from "./components/ProblemTable";
import CompanyCombobox, { MAX_COMPANIES } from "./components/CompanyCombobox";
import ThemeToggle from "./components/ThemeToggle";
import StudyGuides from "./components/StudyGuides";
import { Problem } from "./types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Clock,
  Search,
  Loader2,
  TriangleAlert,
  Crosshair,
  Panda,
  Plus,
  History,
} from "lucide-react";
import { cleanTheme, darkTheme, pandaTheme, type ThemeName } from "@/lib/theme";
import { TIME_OPTIONS } from "@/lib/sources";
import { mergeCompanyResults, type MergedSource } from "@/lib/merge";
import { cn } from "@/lib/utils";

const TIME_HINT: Record<string, string> = {
  "Thirty Days": "Hottest right now — start here",
  "Three Months": "Recent interview pool",
  "Six Months": "Broader recent pool",
  "More Than Six Months": "Older than 6 months — background only",
  All: "Everything tagged, all time",
};

type SourceKind = MergedSource;

type ProblemsPayload = {
  company: string;
  time: string;
  source: "primary" | "fallback";
  fallbackUsed: boolean;
  count: number;
  problems: Problem[];
};

const RECENT_KEY = "csl-recent-companies-v1";
const VALID_THEMES: ThemeName[] = ["clean", "dark", "panda"];

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

const PANDA_FLOATERS = [
  { cls: "floating-panda-1", top: "15%", emoji: "🐼", size: "text-6xl" },
  { cls: "floating-panda-2", top: "65%", emoji: "🐼", size: "text-5xl" },
  { cls: "floating-panda-3", top: "35%", emoji: "🐼", size: "text-6xl" },
  { cls: "floating-panda-4", top: "80%", emoji: "🐼", size: "text-4xl" },
  { cls: "floating-panda-5", top: "25%", emoji: "🎋", size: "text-5xl" },
  { cls: "floating-panda-6", top: "55%", emoji: "🐼", size: "text-5xl" },
  { cls: "floating-panda-vertical-1", top: undefined, emoji: "🐼", size: "text-5xl" },
  { cls: "floating-panda-diagonal-1", top: undefined, emoji: "🎋", size: "text-5xl" },
];

/** Numbered step chip — 1·2 on the field labels make the click order obvious. */
function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
      style={{ backgroundColor: "var(--accentSoft)", color: "var(--accent)" }}
    >
      {n}
    </span>
  );
}

/** Status dot: pulsing accent = action needed, amber = stale, emerald = fresh. */
function StatusDot({ tone, pulse = false }: { tone: "accent" | "amber" | "emerald"; pulse?: boolean }) {
  const color =
    tone === "accent" ? "var(--accent)" : tone === "amber" ? "#d97706" : "#059669";
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

function formatAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Home() {
  // Lazy init from storage so the first paint already matches a returning
  // visitor (no light-flash for dark users). The wrapper below carries
  // suppressHydrationWarning because the prerendered HTML always uses defaults.
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "clean";
    try {
      const saved = window.localStorage.getItem("csl-theme");
      if (saved === "panda" || saved === "dark" || saved === "clean") return saved;
    } catch { /* ignore */ }
    return "clean";
  });
  const [companies, setCompanies] = useState<string[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState("");
  const [companyMeta, setCompanyMeta] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [time, setTime] = useState<string>("All");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [source, setSource] = useState<SourceKind>("primary");
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [partialWarning, setPartialWarning] = useState("");
  const [focusTop30, setFocusTop30] = useState(false);
  const [lastFetched, setLastFetched] = useState<{ selected: string[]; time: string } | null>(null);
  const [freshness, setFreshness] = useState<{ primary: string | null; fallback: string | null } | null>(null);

  const t = theme === "panda" ? pandaTheme : theme === "dark" ? darkTheme : cleanTheme;
  const isPanda = theme === "panda";

  // theme: persist (restore happens in the lazy useState initializer above)
  useEffect(() => {
    try {
      localStorage.setItem("csl-theme", theme);
    } catch { /* ignore */ }
  }, [theme]);

  // restore selection/time/theme from URL on first load (?company=A&company=B)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const fromUrl = sp.getAll("company").filter(Boolean).slice(0, MAX_COMPANIES);
      const tm = sp.get("time");
      const th = sp.get("theme");
      if (fromUrl.length > 0) setSelected(fromUrl);
      if (tm && (TIME_OPTIONS as readonly string[]).includes(tm)) setTime(tm);
      if (th && (VALID_THEMES as string[]).includes(th)) setTheme(th as ThemeName);
    } catch { /* ignore */ }
  }, []);

  // sync URL (shareable links)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.delete("company");
      for (const c of selected) sp.append("company", c);
      sp.set("time", time);
      sp.set("theme", theme);
      window.history.replaceState(null, "", `?${sp.toString()}`);
    } catch { /* ignore */ }
  }, [selected, time, theme]);

  useEffect(() => {
    async function fetchCompanies() {
      setCompaniesLoading(true);
      setCompaniesError("");
      try {
        const res = await fetch("/api/getCompanies");
        if (!res.ok) throw new Error(`Server ${res.status}`);
        const data = await res.json();
        const list: string[] = Array.isArray(data) ? data : data.companies ?? [];
        if (list.length === 0) throw new Error("Empty company list");
        const sorted = [...list].sort((a, b) => a.localeCompare(b));
        setCompanies(sorted);
        setSelected((prev) => {
          if (prev.length > 0) return prev.filter((c) => sorted.includes(c));
          const sp = new URLSearchParams(window.location.search);
          const fromUrl = sp.getAll("company").filter((c) => sorted.includes(c)).slice(0, MAX_COMPANIES);
          if (fromUrl.length > 0) return fromUrl;
          return sorted.includes("Google") ? ["Google"] : sorted.slice(0, 1);
        });
        if (!Array.isArray(data) && (data.primaryCount || data.fallbackCount)) {
          setCompanyMeta(`${sorted.length} companies · primary ${data.primaryCount} + fallback ${data.fallbackCount}`);
        } else {
          setCompanyMeta(`${sorted.length} companies`);
        }
        if (!Array.isArray(data) && data.dataAsOf) {
          setFreshness(data.dataAsOf);
        }
      } catch (e) {
        console.error("Failed to fetch companies:", e);
        setCompaniesError(
          "Couldn't load the company list (upstream rate limit or network). Please wait a minute and reload."
        );
      } finally {
        setCompaniesLoading(false);
      }
    }
    fetchCompanies();
  }, []);

  const fetchProblems = useCallback(async () => {
    if (selected.length === 0) return;
    const snapshot = { selected: [...selected], time };
    setLoading(true);
    setProgress({ done: 0, total: selected.length });
    setError("");
    setPartialWarning("");
    setHasSearched(true);
    try {
      // Each request bumps the counter as it settles — the button reads "Loading 2/3…"
      const wrapped = snapshot.selected.map((company) =>
        (async () => {
          try {
            const res = await fetch(
              `/api/getProblems/${encodeURIComponent(company)}/${encodeURIComponent(snapshot.time)}`
            );
            const data = (await res.json()) as Partial<ProblemsPayload> & { error?: string; problems?: Problem[] };
            if (!res.ok) throw new Error(data.error || `Failed for ${company}`);
            const list = Array.isArray(data) ? (data as unknown as Problem[]) : data.problems ?? [];
            const src = (data as Partial<ProblemsPayload>).source ?? "primary";
            return { company, problems: list, source: src as "primary" | "fallback" };
          } finally {
            setProgress((p) => (p ? { ...p, done: Math.min(p.done + 1, p.total) } : p));
          }
        })()
      );
      const settled = await Promise.allSettled(wrapped);
      const ok = settled
        .filter((r): r is PromiseFulfilledResult<{ company: string; problems: Problem[]; source: "primary" | "fallback" }> => r.status === "fulfilled")
        .map((r) => r.value);
      const failed = settled.length - ok.length;
      if (ok.length === 0) throw new Error("All company requests failed. Please try again.");
      const { problems: merged, source: src } = mergeCompanyResults(ok);
      setProblems(merged);
      setSource(src);
      setLastFetched(snapshot);
      if (failed > 0) {
        setPartialWarning(
          `${failed} of ${settled.length} ${failed === 1 ? "company" : "companies"} failed to load — showing partial results.`
        );
      }
      // recents (most-recent first, max 6)
      setRecent((prev) => {
        const next = [...snapshot.selected, ...prev.filter((c) => !snapshot.selected.includes(c))].slice(0, 6);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch problems. Please try again.");
      setProblems([]);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [selected, time]);

  // auto-run once when arriving via shared link
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("company") && sp.get("autoload") !== "0" && companies.length > 0 && !hasSearched && !loading) {
        fetchProblems();
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length]);

  const visibleProblems = useMemo(() => {
    if (!focusTop30) return problems;
    return [...problems]
      .sort((a, b) => {
        const an = parseFloat(String(a.Frequency).replace("%", "")) || 0;
        const bn = parseFloat(String(b.Frequency).replace("%", "")) || 0;
        return bn - an;
      })
      .slice(0, 30);
  }, [problems, focusTop30]);

  const recentSuggestions = useMemo(
    () => recent.filter((c) => !selected.includes(c) && companies.includes(c)).slice(0, 4),
    [recent, selected, companies]
  );

  // Stale = user changed something since the last successful load → nudge to re-click.
  // Compared as sets so merely reordering chips doesn't cry wolf.
  const stale =
    hasSearched &&
    !loading &&
    lastFetched !== null &&
    (lastFetched.time !== time ||
      lastFetched.selected.length !== selected.length ||
      lastFetched.selected.some((c) => !selected.includes(c)));
  const readyToLoad = !hasSearched && selected.length > 0 && !loading && !companiesLoading && !companiesError;
  const needsAction = (readyToLoad || stale) && !loading;
  const buttonLabel = loading
    ? progress && progress.total > 1
      ? `Loading ${Math.min(progress.done + 1, progress.total)}/${progress.total}…`
      : "Loading…"
    : !hasSearched
      ? "Show questions"
      : stale
        ? "Update results"
        : "Refresh results";

  const sourceLabel =
    source === "primary"
      ? "src · liquidslr (primary)"
      : source === "fallback"
        ? "src · snehasishroy (fallback)"
        : "src · mixed (primary + fallback)";

  return (
    <div
      data-theme={theme}
      suppressHydrationWarning
      className="min-h-screen"
      style={
        {
          backgroundColor: t.pageBg,
          color: t.text,
          "--text": t.text,
          "--muted": t.muted,
          "--accent": t.accent,
          "--card-border": t.cardBorder,
          "--card-bg": t.cardBg,
        } as React.CSSProperties
      }
    >
      {isPanda && (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          {PANDA_FLOATERS.map((p, i) => (
            <div
              key={i}
              className={`${p.cls} absolute ${p.size} opacity-60`}
              style={p.top ? { top: p.top, left: "-100px" } : { left: "10%", top: "-100px" }}
            >
              {p.emoji}
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10">
        {/* Header — static; the results table carries its own sticky thead */}
        <header
          className="border-b"
          style={{
            backgroundColor: isPanda ? "rgba(132, 160, 169, 0.10)" : t.headerBg,
            borderColor: t.cardBorder,
          }}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            {/* Identical skeleton in every theme — only copy/color swap, zero layout shift */}
            <div>
              <p className="t-eyebrow" style={{ color: "var(--accent)" }}>
                {isPanda ? "Original tribute theme" : "Company-targeted LeetCode prep"}
              </p>
              <h1
                className="t-display mt-1 text-stone-900 dark:text-zinc-100"
                style={isPanda ? { color: "#0b0e0e" } : undefined}
              >
                {isPanda ? (
                  <>
                    <span aria-hidden="true">🐼 </span>Panda&apos;s Company Leetcode List
                  </>
                ) : (
                  "Company LeetCode Lists"
                )}
              </h1>
              <p className="t-body prose-measure mt-1.5 text-stone-600 dark:text-zinc-400" style={isPanda ? { color: t.muted, fontSize: 14 } : undefined}>
                {isPanda
                  ? "Analyze trending coding problems from top tech companies."
                  : "Filter 700+ companies by recency and frequency. Learn patterns first, then target the top 30."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle theme={theme} onChange={setTheme} />
            </div>
          </div>
        </header>

        {/* Main — 8pt rhythm: sections 32–40px, cards 20px, gaps 12–16px */}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Control panel */}
          <section
            id="controls"
            aria-label="Search controls"
            className={cn("scroll-mt-4 border p-4 shadow-sm sm:p-5", isPanda ? "rounded-3xl" : "rounded-xl")}
            style={{ backgroundColor: t.cardBg, borderColor: t.cardBorder, borderWidth: 1 }}
          >
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[2fr_1fr_auto]">
              <div className="space-y-1.5">
                <label htmlFor="company-search" className="t-small flex items-center gap-1.5 font-semibold text-stone-700 dark:text-zinc-300" style={isPanda ? { color: t.text } : undefined}>
                  <Step n={1} />
                  <Building2 className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" aria-hidden />
                  Companies
                  <span className="font-normal text-stone-400 dark:text-zinc-500">· up to {MAX_COMPANIES}</span>
                </label>
                <CompanyCombobox
                  companies={companies}
                  selected={selected}
                  onChange={setSelected}
                  disabled={companiesLoading || !!companiesError}
                />
                <p className="t-caption text-stone-500 dark:text-zinc-400">
                  {companiesLoading ? "Loading companies…" : companiesError ? "Company list unavailable" : companyMeta || `${companies.length} companies`}
                </p>
                {recentSuggestions.length > 0 && !companiesLoading && (
                  <p className="t-caption flex flex-wrap items-center gap-1.5 text-stone-500 dark:text-zinc-400">
                    <History className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" aria-hidden />
                    Recent:
                    {recentSuggestions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={selected.length >= MAX_COMPANIES}
                        onClick={() => setSelected((prev) => [...prev, c])}
                        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                        style={{ color: "var(--accent)" }}
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                        {c}
                      </button>
                    ))}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="time-select" className="t-small flex items-center gap-1.5 font-semibold text-stone-700 dark:text-zinc-300" style={isPanda ? { color: t.text } : undefined}>
                  <Step n={2} />
                  <Clock className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" aria-hidden />
                  Time period
                </label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger id="time-select" className="h-10 rounded-lg text-sm" aria-label="Time period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="t-caption text-stone-500 dark:text-zinc-400" aria-live="polite">
                  {TIME_HINT[time]}
                </p>
              </div>

              <div className="flex flex-col justify-end gap-2 self-stretch lg:pt-[26px]">
                <Button
                  onClick={fetchProblems}
                  disabled={loading || selected.length === 0 || !!companiesError}
                  aria-live="polite"
                  className="h-10 rounded-lg px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow disabled:opacity-50 dark:text-zinc-950"
                  style={{
                    backgroundColor: t.buttonBg,
                    color: t.buttonText,
                    ...(needsAction && selected.length > 0
                      ? { boxShadow: "0 0 0 3px var(--accentSoft), 0 1px 2px rgb(0 0 0 / 0.08)" }
                      : undefined),
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {buttonLabel}
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" aria-hidden />
                      {buttonLabel}
                    </>
                  )}
                </Button>
                {/* Step-3 status: tells the user exactly what happens next */}
                <p className="t-caption flex min-h-5 items-center gap-1.5" aria-live="polite">
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-stone-400" aria-hidden />
                      <span className="text-stone-500 dark:text-zinc-400">
                        Fetching{progress && progress.total > 1 ? ` company ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : ""}…
                      </span>
                    </>
                  ) : selected.length === 0 && !companiesLoading && !companiesError ? (
                    <span className="text-stone-500 dark:text-zinc-400">
                      Pick one or more companies above to begin.
                    </span>
                  ) : readyToLoad ? (
                    <>
                      <StatusDot tone="accent" pulse />
                      <span className="font-semibold" style={{ color: "var(--accent)" }}>
                        <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full align-[-2px] text-[10px] font-bold" style={{ backgroundColor: "var(--accentSoft)", color: "var(--accent)" }} aria-hidden>3</span>
                        Ready — click “Show questions” to load.
                      </span>
                    </>
                  ) : stale ? (
                    <>
                      <StatusDot tone="amber" pulse />
                      <span className="font-semibold text-amber-700 dark:text-amber-400">
                        Changed — click “Update results”.
                      </span>
                    </>
                  ) : hasSearched && problems.length > 0 ? (
                    <>
                      <StatusDot tone="emerald" />
                      <span className="text-stone-400 dark:text-zinc-500">Results are up to date.</span>
                    </>
                  ) : null}
                </p>
                {problems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFocusTop30((v) => !v)}
                    aria-pressed={focusTop30}
                    className={cn(
                      "t-caption flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-semibold transition-colors",
                      focusTop30 ? "text-white dark:text-zinc-950" : "bg-transparent text-stone-600 hover:bg-stone-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    )}
                    style={
                      focusTop30
                        ? { backgroundColor: t.accent, borderColor: t.accent }
                        : { borderColor: t.cardBorder }
                    }
                    title="Limit to the 30 highest-frequency problems"
                  >
                    <Crosshair className="h-3.5 w-3.5" aria-hidden />
                    {focusTop30 ? "Showing top 30 · show all" : "Focus: top 30"}
                  </button>
                )}
              </div>
            </div>

            {companiesError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/40" role="alert">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
                <div className="text-sm">
                  <p className="font-semibold text-red-700 dark:text-red-300">Company list failed to load</p>
                  <p className="mt-0.5 text-red-600 dark:text-red-400">{companiesError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => window.location.reload()}>
                    Reload
                  </Button>
                </div>
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/40" role="alert">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
            {partialWarning && !error && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/40" role="status">
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                  {partialWarning}
                </p>
              </div>
            )}
          </section>

          {/* Muted data-source line — mono caption, recedes by design */}
          {hasSearched && problems.length > 0 && (
            <p className="t-mono mt-3 text-[11.5px] text-stone-400 dark:text-zinc-500" aria-live="polite">
              {sourceLabel}
              {"  ·  "}{selected.join(" + ")} · {time}{focusTop30 ? " · top 30" : ""} · n={problems.length}
              {(() => {
                const iso =
                  source === "primary"
                    ? freshness?.primary
                    : source === "fallback"
                      ? freshness?.fallback
                      : [freshness?.primary, freshness?.fallback].filter(Boolean).sort().reverse()[0];
                const label = formatAsOf(iso ?? null);
                return label ? ` · data as of ${label}` : null;
              })()}
            </p>
          )}

          {/* Results */}
          <div className="mt-4">
            <ProblemTable
              problems={visibleProblems}
              theme={theme}
              fallbackUsed={source !== "primary"}
              loading={loading}
              companyLabel={selected.join(" + ")}
              timeLabel={time}
            />
          </div>

          <StudyGuides />

          {/* Footer — constrained measure, quiet caption */}
          <footer className="prose-measure mt-10 border-t border-stone-200 pt-5 dark:border-zinc-800">
            <p className="t-caption text-stone-500 dark:text-zinc-400">
              Frequency is the best frequency seen across your selected companies (100 = most-asked
              there), not a hiring probability. Difficulty and acceptance follow the
              highest-frequency source so multi-company merges are deterministic. Tags are
              user-reported LeetCode Premium data — noisy for small companies. Acceptance rates are
              repaired from upstream scale errors; treat as rough.
            </p>
            <p className="t-caption mt-2 flex flex-wrap items-center gap-x-2 text-stone-400 dark:text-zinc-500">
              <span className="inline-flex items-center gap-1">
                {isPanda ? <Panda className="h-3 w-3" aria-hidden /> : null}
                Sources: liquidslr (primary) · snehasishroy July 2026 snapshot (fallback)
              </span>
              <span aria-hidden="true">·</span>
              <span>Not affiliated with LeetCode.</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
