"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  ExternalLink,
  Hash,
  TrendingUp,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  Circle,
  Check,
  Info,
  ArrowUpDown,
  ArrowUpToLine,
  Columns3,
  Download,
} from "lucide-react";
import { Problem } from "../types/problem";
import { getDifficultyStyle, type ThemeName } from "@/lib/theme";
import {
  acceptanceValue,
  formatAcceptance,
  formatFrequency,
  frequencyLabel,
  frequencyValue,
} from "@/lib/format";
import { problemsToCsv } from "@/lib/csv";
import TopicMultiSelect from "./TopicMultiSelect";
import { cn } from "@/lib/utils";

type SortField = keyof Problem | `freq:${string}` | "none";
type SortDirection = "asc" | "desc";
interface SortRule {
  field: Exclude<SortField, "none">;
  dir: SortDirection;
}

/** `freq:Acme` secondary field id for per-company compare columns. */
function freqField(company: string): Exclude<SortField, "none"> {
  return `freq:${company}` as Exclude<SortField, "none">;
}
function freqCompany(field: string): string | null {
  return field.startsWith("freq:") ? field.slice("freq:".length) : null;
}

function readTableParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

const difficultyOrder: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3, Unknown: 4 };
const SOLVED_KEY = "csl-solved-links-v1";
/** Cap persisted solved links so decade-long grinding can't bloat localStorage. */
const MAX_SOLVED_STORED = 3000;
/** Confirm before generating very large downloads. */
const CSV_CONFIRM_ROWS = 3000;
const PAGE_SIZES = [10, 20, 50];

function loadSolved(): Set<string> {
  try {
    const raw = localStorage.getItem(SOLVED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function defaultDir(field: SortField): SortDirection {
  return field === "Title" || field === "Difficulty" ? "asc" : "desc";
}

function compareBy(rule: SortRule, a: Problem, b: Problem): number {
  let av: string | number;
  let bv: string | number;
  const f = rule.field;
  if (f === "Difficulty") {
    av = difficultyOrder[a.Difficulty] ?? 99;
    bv = difficultyOrder[b.Difficulty] ?? 99;
  } else if (f === "Frequency") {
    av = frequencyValue(a.Frequency);
    bv = frequencyValue(b.Frequency);
  } else if (f === "Acceptance Rate") {
    av = acceptanceValue(a["Acceptance Rate"]);
    bv = acceptanceValue(b["Acceptance Rate"]);
  } else if (f === "Topics") {
    av = (a.Topics ?? []).join(", ").toLowerCase();
    bv = (b.Topics ?? []).join(", ").toLowerCase();
  } else if (f === "Title") {
    av = a.Title.toLowerCase();
    bv = b.Title.toLowerCase();
  } else if (freqCompany(f) !== null) {
    // Per-company compare column: missing values sort last either direction.
    const c = freqCompany(f) as string;
    const avRaw = a.Frequencies?.[c];
    const bvRaw = b.Frequencies?.[c];
    av = avRaw === undefined ? -1 : frequencyValue(avRaw);
    bv = bvRaw === undefined ? -1 : frequencyValue(bvRaw);
  } else {
    const key = f as keyof Problem;
    av = String(a[key] ?? "").toLowerCase();
    bv = String(b[key] ?? "").toLowerCase();
  }
  if (av < bv) return rule.dir === "asc" ? -1 : 1;
  if (av > bv) return rule.dir === "asc" ? 1 : -1;
  return 0;
}

export default function ProblemTable({
  problems,
  theme,
  fallbackUsed,
  loading = false,
  companyLabel = "",
  timeLabel = "",
}: {
  problems: Problem[];
  theme: ThemeName;
  fallbackUsed: boolean;
  loading?: boolean;
  companyLabel?: string;
  timeLabel?: string;
}) {
  // Multi-column sort: plain click = single sort, Shift+click = add/toggle secondary.
  const [sorts, setSorts] = useState<SortRule[]>([{ field: "Frequency", dir: "desc" }]);
  // Filter state restores from the URL so filtered views are shareable and
  // survive refresh (written back by the sync effect below).
  const [searchTerm, setSearchTerm] = useState(() => readTableParams()?.get("q") ?? "");
  const [difficultyFilter, setDifficultyFilter] = useState<string>(() => {
    const d = readTableParams()?.get("difficulty");
    return d && d.trim() ? d : "all";
  });
  const [topicFilter, setTopicFilter] = useState<string[]>(() => {
    const sp = readTableParams();
    return sp ? sp.getAll("topic").filter(Boolean) : [];
  });
  const [currentPage, setCurrentPage] = useState(() => {
    const p = parseInt(readTableParams()?.get("page") ?? "", 10);
    return Number.isFinite(p) && p >= 1 ? p : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const p = parseInt(readTableParams()?.get("rows") ?? "", 10);
    return PAGE_SIZES.includes(p) ? p : 20;
  });
  const [jumpVal, setJumpVal] = useState("");
  // loadSolved is SSR-safe (storage access is try/caught) and problems start
  // empty, so hydrating from storage here can't mismatch the first paint.
  const [solved, setSolved] = useState<Set<string>>(loadSolved);
  const [showUnsolvedOnly, setShowUnsolvedOnly] = useState(
    () => readTableParams()?.get("unsolved") === "1"
  );
  const [compare, setCompare] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isPanda = theme === "panda";
  const isDark = theme === "dark";
  const cardRadius = isPanda ? "rounded-3xl" : "rounded-xl";

  // Reset pagination when a new result set arrives. Done as a render-time
  // adjustment on prop identity (the documented alternative to syncing in
  // an effect) — no cascade, no lint exception needed.
  const [seenProblems, setSeenProblems] = useState(problems);
  if (seenProblems !== problems) {
    setSeenProblems(problems);
    setCurrentPage(1);
    setJumpVal("");
  }

  // "/" focuses the result search (like GitHub/Linear) when not already typing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (problems.length === 0) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [problems.length]);

  function toggleSolved(link: string) {
    setSolved((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      try {
        const arr = [...next];
        localStorage.setItem(
          SOLVED_KEY,
          JSON.stringify(arr.length > MAX_SOLVED_STORED ? arr.slice(-MAX_SOLVED_STORED) : arr)
        );
      } catch {
        /* storage unavailable — non-fatal */
      }
      return next;
    });
  }

  /** Clear solved marks for just this result set (bulk undo after a grind). */
  function resetSolvedForResults() {
    setSolved((prev) => {
      const next = new Set(prev);
      for (const p of problems) next.delete(p.Link);
      try {
        localStorage.setItem(SOLVED_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable — non-fatal */
      }
      return next;
    });
  }

  /** Mark every problem on the current page solved. */
  function markPageSolved() {
    setSolved((prev) => {
      const next = new Set(prev);
      for (const p of paginated) next.add(p.Link);
      try {
        const arr = [...next];
        localStorage.setItem(
          SOLVED_KEY,
          JSON.stringify(arr.length > MAX_SOLVED_STORED ? arr.slice(-MAX_SOLVED_STORED) : arr)
        );
      } catch {
        /* storage unavailable — non-fatal */
      }
      return next;
    });
  }

  /** Legend/difficulty shortcuts share one toggle. */
  function toggleDifficulty(d: string) {
    setDifficultyFilter((prev) => (prev === d ? "all" : d));
    setCurrentPage(1);
  }

  const uniqueDifficulties = useMemo(
    () => Array.from(new Set(problems.map((p) => p.Difficulty))).sort(),
    [problems]
  );
  // Unknown difficulty values (e.g. stale shared links) degrade to "all"
  // instead of silently emptying the results.
  const effectiveDifficulty =
    difficultyFilter === "all" || uniqueDifficulties.includes(difficultyFilter)
      ? difficultyFilter
      : "all";
  const uniqueTopics = useMemo(
    () => Array.from(new Set(problems.flatMap((p) => p.Topics ?? []))).sort(),
    [problems]
  );
  const hasTopics = uniqueTopics.length > 0;
  const multiCompany = useMemo(
    () => problems.some((p) => (p.Companies ?? []).length > 1),
    [problems]
  );
  /** Distinct companies across the result set — drives compare columns. */
  const compareCompanies = useMemo(() => {
    const s = new Set<string>();
    for (const p of problems) {
      for (const c of p.Companies ?? [p.Company]) s.add(c);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [problems]);
  const canCompare = compareCompanies.length > 1;

  const stats = useMemo(() => {
    let easy = 0,
      medium = 0,
      hard = 0;
    for (const p of problems) {
      if (p.Difficulty === "Easy") easy += 1;
      else if (p.Difficulty === "Medium") medium += 1;
      else if (p.Difficulty === "Hard") hard += 1;
    }
    const solvedCount = problems.filter((p) => solved.has(p.Link)).length;
    const total = problems.length || 1;
    return {
      total: problems.length,
      Easy: easy,
      Medium: medium,
      Hard: hard,
      solvedCount,
      easyPct: (easy / total) * 100,
      medPct: (medium / total) * 100,
      hardPct: (hard / total) * 100,
      solvedPct: (solvedCount / total) * 100,
    };
  }, [problems, solved]);

  const filteredAndSorted = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = problems.filter((problem) => {
      const matchesSearch =
        !q ||
        problem.Title.toLowerCase().includes(q) ||
        (problem.Topics ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (problem.Companies ?? []).some((c) => c.toLowerCase().includes(q));
      const matchesDifficulty =
        effectiveDifficulty === "all" || problem.Difficulty === effectiveDifficulty;
      const matchesTopic =
        topicFilter.length === 0 ||
        topicFilter.some((t) => (problem.Topics ?? []).includes(t));
      const matchesSolved = !showUnsolvedOnly || !solved.has(problem.Link);
      return matchesSearch && matchesDifficulty && matchesTopic && matchesSolved;
    });

    if (sorts.length === 0) return filtered;
    return [...filtered].sort((a, b) => {
      for (const rule of sorts) {
        const cmp = compareBy(rule, a, b);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [problems, searchTerm, effectiveDifficulty, topicFilter, showUnsolvedOnly, solved, sorts]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = filteredAndSorted.slice(startIndex, startIndex + pageSize);

  // Write filter state back to the URL (company/time/theme keys belong to the
  // page effect — each writer preserves the other's keys, and replaceState
  // never re-triggers effects, so they can't loop). Lives down here because
  // it reads safePage.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (searchTerm.trim()) sp.set("q", searchTerm.trim());
      else sp.delete("q");
      if (effectiveDifficulty !== "all") sp.set("difficulty", effectiveDifficulty);
      else sp.delete("difficulty");
      sp.delete("topic");
      for (const t of topicFilter) sp.append("topic", t);
      if (showUnsolvedOnly) sp.set("unsolved", "1");
      else sp.delete("unsolved");
      if (pageSize !== 20) sp.set("rows", String(pageSize));
      else sp.delete("rows");
      if (safePage !== 1) sp.set("page", String(safePage));
      else sp.delete("page");
      window.history.replaceState(null, "", `?${sp.toString()}`);
    } catch {
      /* ignore */
    }
  }, [searchTerm, effectiveDifficulty, topicFilter, showUnsolvedOnly, pageSize, safePage]);

  function handleSort(field: Exclude<SortField, "none">, additive: boolean) {
    setCurrentPage(1);
    setSorts((prev) => {
      const idx = prev.findIndex((s) => s.field === field);
      if (!additive) {
        // plain click: single sort. Re-clicking the sole active rule cycles
        // its direction (and finally clears); picking any other column always
        // starts from that column's natural default so identical gestures
        // never produce different orders depending on hidden state.
        if (idx === 0 && prev.length === 1) {
          return prev[0].dir === "asc"
            ? [{ field, dir: "desc" }]
            : [];
        }
        return [{ field, dir: defaultDir(field) }];
      }
      // Shift+click: toggle/cycle as secondary, keep priority order
      if (idx >= 0) {
        const cur = prev[idx];
        if (cur.dir === "asc") {
          const next = [...prev];
          next[idx] = { field, dir: "desc" };
          return next;
        }
        return prev.filter((s) => s.field !== field);
      }
      return [...prev, { field, dir: defaultDir(field) }];
    });
  }

  function sortMeta(field: Exclude<SortField, "none">): { active: boolean; dir: SortDirection; order: number } {
    const idx = sorts.findIndex((s) => s.field === field);
    return {
      active: idx >= 0,
      dir: idx >= 0 ? sorts[idx].dir : "asc",
      order: idx + 1,
    };
  }

  function sortIcon(field: Exclude<SortField, "none">) {
    const meta = sortMeta(field);
    const cls = "h-3.5 w-3.5 shrink-0";
    const badge =
      sorts.length > 1 && meta.active ? (
        <sup className="t-mono text-[10px] font-bold" aria-hidden style={{ color: "var(--accent)" }}>
          {meta.order}
        </sup>
      ) : null;
    return (
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {meta.active ? (
          meta.dir === "asc" ? (
            <ArrowUp className={cls} style={{ color: "var(--accent)" }} aria-hidden />
          ) : (
            <ArrowDown className={cls} style={{ color: "var(--accent)" }} aria-hidden />
          )
        ) : (
          <ArrowUpDown className={cn(cls, "text-stone-300 dark:text-zinc-600")} aria-hidden />
        )}
        {badge}
      </span>
    );
  }

  /** aria-labels carry the multi-sort priority because aria-label overrides
      inner content — an sr-only span inside would never be announced. */
  function sortAriaLabel(base: string, field: Exclude<SortField, "none">): string {
    const meta = sortMeta(field);
    if (sorts.length > 1 && meta.active) {
      return `${base} Currently sort priority ${meta.order} of ${sorts.length}, ${meta.dir === "asc" ? "ascending" : "descending"}.`;
    }
    return base;
  }

  function ariaSort(field: Exclude<SortField, "none">): "ascending" | "descending" | "none" {
    // Expose only the primary sort: screen readers (and the ARIA spec) model
    // a single sorted column, even when several rules are stacked visually.
    if (sorts.length === 0 || sorts[0].field !== field) return "none";
    return sorts[0].dir === "asc" ? "ascending" : "descending";
  }

  function clearFilters() {
    setSearchTerm("");
    setDifficultyFilter("all");
    setTopicFilter([]);
    setSorts([{ field: "Frequency", dir: "desc" }]);
    setShowUnsolvedOnly(false);
    setCurrentPage(1);
  }

  const pills: { key: string; label: string; clear: () => void }[] = [];
  if (searchTerm.trim()) pills.push({ key: "q", label: `“${searchTerm.trim()}”`, clear: () => { setSearchTerm(""); setCurrentPage(1); } });
  if (effectiveDifficulty !== "all") pills.push({ key: "d", label: effectiveDifficulty, clear: () => { setDifficultyFilter("all"); setCurrentPage(1); } });
  for (const t of topicFilter) {
    pills.push({ key: `t:${t}`, label: t, clear: () => { setTopicFilter((prev) => prev.filter((x) => x !== t)); setCurrentPage(1); } });
  }
  if (showUnsolvedOnly) pills.push({ key: "u", label: "Unsolved", clear: () => setShowUnsolvedOnly(false) });

  function exportCsv() {
    if (
      filteredAndSorted.length > CSV_CONFIRM_ROWS &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Export ${filteredAndSorted.length.toLocaleString()} rows as CSV?`
      )
    ) {
      return;
    }
    const csv = problemsToCsv(filteredAndSorted);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (companyLabel || "leetcode").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    a.href = url;
    a.download = `${slug || "leetcode"}${timeLabel ? `-${timeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function goToTop() {
    document.getElementById("controls")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitJump(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(jumpVal, 10);
    if (Number.isFinite(n)) {
      setCurrentPage(Math.min(Math.max(1, n), totalPages));
      setJumpVal("");
    }
  }

  // Loading skeleton (first fetch) — keeps layout stable, beats a bare spinner
  if (problems.length === 0 && loading) {
    return (
      <div className={cn("border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5", cardRadius)} role="status" aria-label="Loading problems">
        <div className="flex items-center gap-3">
          <div className="h-5 w-40 animate-pulse rounded-md bg-stone-100 dark:bg-zinc-800" />
          <div className="h-5 w-24 animate-pulse rounded-md bg-stone-100 dark:bg-zinc-800" />
        </div>
        <div className="mt-4 space-y-2.5" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-6 w-16 animate-pulse rounded-md bg-stone-100 dark:bg-zinc-800" />
              <div className="h-4 flex-1 animate-pulse rounded bg-stone-100 dark:bg-zinc-800" style={{ animationDelay: `${i * 60}ms` }} />
              <div className="h-4 w-14 animate-pulse rounded bg-stone-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
        <p className="t-caption mt-4 text-stone-500 dark:text-zinc-400">Fetching company data…</p>
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center border border-stone-200 bg-white px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900",
          cardRadius
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-zinc-800" aria-hidden>
          <Search className="h-5 w-5 text-stone-500 dark:text-zinc-400" />
        </span>
        <h3 className="t-h2 mt-4 text-stone-900 dark:text-zinc-100">No problems yet</h3>
        <p className="t-small prose-measure mt-1.5 text-stone-600 dark:text-zinc-400">
          Select companies and a time period, then Analyze to see the
          highest-frequency problems{isPanda ? " 🐼" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Results header — layer-cake scanning: H2 + counts, then mix bar */}
      <div
        className={cn("border border-stone-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-5", cardRadius)}
        aria-label="Result summary"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="t-h2 text-stone-900 dark:text-zinc-100">Results</h2>
          <p className="tnum text-[12px] font-medium text-stone-500 dark:text-zinc-400">
            {filteredAndSorted.length !== problems.length
              ? `${filteredAndSorted.length} of ${problems.length}`
              : `${problems.length} problems`}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <p className="t-caption flex items-center gap-1.5 text-stone-500 dark:text-zinc-400">
              <CircleCheck className="h-3.5 w-3.5 text-stone-500 dark:text-zinc-400" aria-hidden />
              <span className="tnum font-semibold text-stone-700 dark:text-zinc-200">
                {stats.solvedCount}/{stats.total}
              </span>{" "}
              solved
            </p>
            {stats.solvedCount > 0 && (
              <button
                type="button"
                onClick={resetSolvedForResults}
                className="t-caption font-semibold text-stone-500 underline-offset-2 transition-colors hover:text-stone-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
                title="Clear solved marks for these results only"
              >
                Reset
              </button>
            )}
            {paginated.some((p) => !solved.has(p.Link)) && (
              <button
                type="button"
                onClick={markPageSolved}
                className="t-caption font-semibold text-stone-500 underline-offset-2 transition-colors hover:text-stone-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
                title="Mark every problem on this page solved"
              >
                Mark page
              </button>
            )}
            {canCompare && (
              <Button
                variant={compare ? "default" : "outline"}
                size="sm"
                onClick={() => setCompare((v) => !v)}
                className="h-8 rounded-lg text-[13px] font-semibold"
                aria-pressed={compare}
                title="One frequency column per company"
              >
                <Columns3 className="h-3.5 w-3.5" aria-hidden />
                Compare
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              className="h-8 rounded-lg text-[13px] font-semibold"
              aria-label={`Export ${filteredAndSorted.length} filtered problems as CSV`}
              title="Download the filtered list as CSV"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </Button>
          </div>
        </div>
        {/* Difficulty mix — proportional bars that double as filter toggles */}
        <div
          className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800"
          role="group"
          aria-label="Filter by difficulty"
        >
          {(
            [
              { name: "Easy", pct: stats.easyPct, count: stats.Easy, color: "#059669" },
              { name: "Medium", pct: stats.medPct, count: stats.Medium, color: "#d97706" },
              { name: "Hard", pct: stats.hardPct, count: stats.Hard, color: "#e11d48" },
            ] as const
          ).map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => toggleDifficulty(s.name)}
              aria-pressed={effectiveDifficulty === s.name}
              title={`${s.count} ${s.name} — click to filter`}
              aria-label={`${s.count} ${s.name} problems. Activate to filter.`}
              style={{ width: `${s.pct}%`, backgroundColor: s.color }}
              className="h-full min-w-1 transition-opacity hover:opacity-80 focus-visible:opacity-80"
            />
          ))}
        </div>
        <div className="t-caption mt-2 flex flex-wrap gap-x-2 gap-y-1 text-stone-500 dark:text-zinc-400">
          {(
            [
              { name: "Easy", count: stats.Easy, dot: "bg-emerald-600" },
              { name: "Medium", count: stats.Medium, dot: "bg-amber-600" },
              { name: "Hard", count: stats.Hard, dot: "bg-rose-600" },
            ] as const
          ).map((s) => {
            const active = effectiveDifficulty === s.name;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => toggleDifficulty(s.name)}
                aria-pressed={active}
                title={`Filter: ${s.name}`}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-stone-100 dark:hover:bg-zinc-800"
                style={active ? { boxShadow: "0 0 0 2px var(--accentSoft)" } : undefined}
              >
                <span className={cn("inline-block h-2 w-2 rounded-full", s.dot)} aria-hidden />
                <span className="tnum font-semibold text-stone-700 dark:text-zinc-200">{s.count}</span> {s.name}
              </button>
            );
          })}
        </div>
        {stats.total > 0 && (
          <div
            className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuenow={Math.round(stats.solvedPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Solved progress"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${stats.solvedPct}%`, backgroundColor: "var(--accent)" }}
            />
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div
        className={cn("border border-stone-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4", cardRadius)}
      >
        <div className="flex flex-col flex-wrap gap-2.5 sm:flex-row">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500 dark:text-zinc-400"
              aria-hidden
            />
            <Input
              ref={searchRef}
              placeholder="Search problems, topics, companies…  ( / )"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Search problems, topics, or companies"
              className="h-10 rounded-lg pl-9 text-base sm:text-sm"
            />
          </div>
          <Select
            value={difficultyFilter}
            onValueChange={(v) => {
              setDifficultyFilter(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by difficulty">
              <Filter className="h-3.5 w-3.5 text-stone-500 dark:text-zinc-400" aria-hidden />
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All difficulties</SelectItem>
              {uniqueDifficulties.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasTopics ? (
            <TopicMultiSelect
              topics={uniqueTopics}
              selected={topicFilter}
              onChange={(v) => {
                setTopicFilter(v);
                setCurrentPage(1);
              }}
            />
          ) : null}
          <Button
            variant={showUnsolvedOnly ? "default" : "outline"}
            onClick={() => {
              setShowUnsolvedOnly((v) => !v);
              setCurrentPage(1);
            }}
            className="t-small h-10 rounded-lg font-semibold"
            aria-pressed={showUnsolvedOnly}
            title="Hide problems you've marked solved"
          >
            {showUnsolvedOnly ? (
              <CircleCheck className="h-4 w-4" aria-hidden />
            ) : (
              <Circle className="h-4 w-4" aria-hidden />
            )}
            Unsolved only
          </Button>
        </div>

        {/* Active filter pills — remove one without nuking the rest */}
        {pills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
            {pills.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={p.clear}
                aria-label={`Remove filter ${p.label}`}
                className="t-caption inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-2.5 pr-1.5 font-semibold text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                <span className="max-w-48 truncate">{p.label}</span>
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="t-caption font-semibold text-stone-500 underline-offset-2 transition-colors hover:text-stone-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Clear all
            </button>
          </div>
        )}

        <p className="t-caption mt-2.5 text-stone-500 dark:text-zinc-400">
          Tip: Shift+click column headers to sort by more than one column.
          {fallbackUsed && (
            <span className="mt-1 flex items-start gap-1.5 text-stone-500 dark:text-zinc-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500 dark:text-zinc-400" aria-hidden />
              Topics aren&apos;t available for this result (fallback dataset) — search and the
              topic filter cover titles only.
            </span>
          )}
        </p>
      </div>

      {/* Mobile cards — identifier first, meta inline, actions last */}
      <div className="block space-y-2.5 md:hidden">
        {paginated.map((problem) => {
          const d = getDifficultyStyle(problem.Difficulty, isDark);
          const done = solved.has(problem.Link);
          const coList = problem.Companies ?? [problem.Company];
          return (
            <article
              key={problem.Link}
              className={cn("border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900", cardRadius, done && "opacity-70")}
            >
              <h3
                className={cn("line-clamp-3 text-[14px] font-semibold leading-snug tracking-[-0.005em] text-stone-900 dark:text-zinc-100", done && "line-through decoration-stone-300 dark:decoration-zinc-600")}
              >
                {problem.Title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <Badge
                  variant="outline"
                  className="text-[12px] font-semibold"
                  style={{ backgroundColor: d.bg, color: d.text, borderColor: d.border }}
                >
                  {problem.Difficulty}
                </Badge>
                <span className="tnum text-[13px] font-semibold text-stone-700 dark:text-zinc-200">
                  {formatFrequency(problem.Frequency)}
                </span>
                <span className="t-caption text-stone-500 dark:text-zinc-400">{frequencyLabel(problem.Frequency)} ·</span>
                <span className="tnum text-[13px] font-semibold text-stone-700 dark:text-zinc-200">
                  {formatAcceptance(problem["Acceptance Rate"])}
                </span>
                <span className="t-caption text-stone-500 dark:text-zinc-400">accepted</span>
              </div>
              {compare && canCompare && (
                <dl className="mt-2 grid grid-cols-2 gap-1">
                  {compareCompanies.map((c) => {
                    const raw = problem.Frequencies?.[c];
                    return (
                      <div key={c} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-2 py-1.5 dark:bg-zinc-800/60">
                        <dt className="t-caption truncate font-medium text-stone-500 dark:text-zinc-400" title={c}>{c}</dt>
                        <dd className="tnum shrink-0 text-[13px] font-semibold text-stone-800 dark:text-zinc-100">
                          {raw === undefined ? "—" : formatFrequency(raw)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              {(multiCompany || coList.length > 1) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {coList.slice(0, 3).map((c) => (
                    <span key={c} className="t-caption rounded-md px-1.5 py-0.5 font-semibold" style={{ backgroundColor: "var(--accentSoft)", color: "var(--accent)" }}>
                      {c}
                    </span>
                  ))}
                  {coList.length > 3 && (
                    <span className="t-caption rounded-md bg-stone-100 px-1.5 py-0.5 font-medium text-stone-500 dark:bg-zinc-800 dark:text-zinc-400">
                      +{coList.length - 3}
                    </span>
                  )}
                </div>
              )}
              {(problem.Topics ?? []).length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(problem.Topics ?? []).slice(0, 5).map((t) => (
                    <Badge key={t} variant="secondary" className="t-caption font-medium">
                      {t}
                    </Badge>
                  ))}
                  {(problem.Topics ?? []).length > 5 && (
                    <Badge variant="outline" title={(problem.Topics ?? []).join(", ")} className="t-caption font-medium">
                      +{(problem.Topics ?? []).length - 5} more
                    </Badge>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-2.5 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => toggleSolved(problem.Link)}
                  aria-pressed={done}
                  aria-label={done ? `Mark ${problem.Title} as unsolved` : `Mark ${problem.Title} as solved`}
                  className={cn(
                    "t-small flex items-center gap-1.5 rounded-full px-3 py-2 font-semibold transition-all",
                    done
                      ? ""
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  )}
                  style={done ? { backgroundColor: "var(--accentSoft)", color: "var(--accent)" } : undefined}
                >
                  {done ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: "var(--accent)" }} aria-hidden>
                      <Check className="h-3 w-3 text-white dark:text-zinc-950" strokeWidth={3.5} aria-hidden />
                    </span>
                  ) : (
                    <Circle className="h-4 w-4 text-stone-300 dark:text-zinc-600" aria-hidden />
                  )}
                  {done ? "Solved" : "Mark solved"}
                </button>
                <Button variant="outline" size="sm" asChild className="h-9 rounded-lg px-3 text-[13px] font-semibold" aria-label={`Open ${problem.Title} on LeetCode`}>
                  <a href={problem.Link} target="_blank" rel="noopener noreferrer">
                    Open <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop table — identifier first, numerics right, sticky opaque header */}
      <div
        className={cn("hidden border border-stone-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 md:block", cardRadius)}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-stone-50 shadow-[0_1px_0_0_#e7e5e4] dark:bg-zinc-800 dark:shadow-[0_1px_0_0_#27272a]">
              <TableRow className="border-b border-stone-200 hover:bg-stone-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                <TableHead className="min-w-52 pl-5" aria-sort={ariaSort("Title")}>
                  <button
                    type="button"
                    onClick={(e) => handleSort("Title", e.shiftKey)}
                    aria-label={sortAriaLabel("Sort by problem title. Shift-click to add as secondary sort.", "Title")}
                    title="Shift-click to add as secondary sort"
                    className="t-th flex items-center gap-1.5 py-2.5 text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    Problem {sortIcon("Title")}
                  </button>
                </TableHead>
                <TableHead aria-sort={ariaSort("Difficulty")}>
                  <button
                    type="button"
                    onClick={(e) => handleSort("Difficulty", e.shiftKey)}
                    aria-label={sortAriaLabel("Sort by difficulty. Shift-click to add as secondary sort.", "Difficulty")}
                    title="Shift-click to add as secondary sort"
                    className="t-th flex items-center gap-1.5 py-2.5 text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    Difficulty {sortIcon("Difficulty")}
                  </button>
                </TableHead>
                {compare && canCompare && compareCompanies.map((c) => (
                  <TableHead key={c} className="text-right" aria-sort={ariaSort(freqField(c))}>
                    <button
                      type="button"
                      onClick={(e) => handleSort(freqField(c), e.shiftKey)}
                      aria-label={sortAriaLabel(`Sort by ${c} frequency. Shift-click to add as secondary sort.`, freqField(c))}
                      title="Shift-click to add as secondary sort"
                      className="t-th ml-auto flex max-w-28 items-center gap-1.5 py-2.5 text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      <span className="truncate" title={c}>{c}</span> {sortIcon(freqField(c))}
                    </button>
                  </TableHead>
                ))}
                <TableHead className="text-right" aria-sort={ariaSort("Frequency")}>
                  <button
                    type="button"
                    onClick={(e) => handleSort("Frequency", e.shiftKey)}
                    aria-label={sortAriaLabel("Sort by frequency. Shift-click to add as secondary sort.", "Frequency")}
                    title="Shift-click to add as secondary sort"
                    className="t-th ml-auto flex items-center gap-1.5 py-2.5 text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    Freq. {sortIcon("Frequency")}
                  </button>
                </TableHead>
                <TableHead className="text-right" aria-sort={ariaSort("Acceptance Rate")}>
                  <button
                    type="button"
                    onClick={(e) => handleSort("Acceptance Rate", e.shiftKey)}
                    aria-label={sortAriaLabel("Sort by acceptance rate. Shift-click to add as secondary sort.", "Acceptance Rate")}
                    title="Shift-click to add as secondary sort"
                    className="t-th ml-auto flex items-center gap-1.5 py-2.5 text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Accept. {sortIcon("Acceptance Rate")}
                  </button>
                </TableHead>
                <TableHead>
                  <span className="t-th flex items-center gap-1.5 py-2.5 text-stone-500 dark:text-zinc-400">
                    <Hash className="h-3.5 w-3.5" aria-hidden />
                    Topics
                  </span>
                </TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">Open on LeetCode</span>
                </TableHead>
                <TableHead className="w-14 pr-5">
                  <span className="sr-only">Solved</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((problem) => {
                const d = getDifficultyStyle(problem.Difficulty, isDark);
                const done = solved.has(problem.Link);
                const coList = problem.Companies ?? [problem.Company];
                return (
                  <TableRow key={problem.Link} className={cn("border-b border-stone-100 transition-colors hover:bg-stone-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60", done && "opacity-60")}>
                    <TableCell className="min-w-52 max-w-72 py-2.5 pl-5">
                      <span className={cn("t-small line-clamp-2 font-medium text-stone-900 dark:text-zinc-100", done && "line-through decoration-stone-300 dark:decoration-zinc-600")} title={problem.Title}>
                        {problem.Title}
                      </span>
                      {(multiCompany || coList.length > 1) && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {coList.slice(0, 2).map((c) => (
                            <span key={c} className="t-caption rounded px-1.5 py-px font-semibold" style={{ backgroundColor: "var(--accentSoft)", color: "var(--accent)" }}>
                              {c}
                            </span>
                          ))}
                          {coList.length > 2 && (
                            <span className="t-caption rounded bg-stone-100 px-1.5 py-px font-medium text-stone-500 dark:bg-zinc-800 dark:text-zinc-400" title={coList.slice(2).join(", ")}>
                              +{coList.length - 2}
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Badge
                        variant="outline"
                        className="text-[12px] font-semibold"
                        style={{ backgroundColor: d.bg, color: d.text, borderColor: d.border }}
                      >
                        {problem.Difficulty}
                      </Badge>
                    </TableCell>
                    {compare && canCompare && compareCompanies.map((c) => {
                      const raw = problem.Frequencies?.[c];
                      return (
                        <TableCell key={c} className="py-2.5 text-right">
                          {raw === undefined ? (
                            <span className="t-caption text-stone-300 dark:text-zinc-600" title={`Not tagged for ${c}`} aria-label={`Not tagged for ${c}`}>—</span>
                          ) : (
                            <span className="tnum text-[13px] font-semibold text-stone-900 dark:text-zinc-100">
                              {formatFrequency(raw)}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="py-2.5 text-right">
                      <span className="tnum block text-[13px] font-semibold text-stone-900 dark:text-zinc-100">
                        {formatFrequency(problem.Frequency)}
                      </span>
                      <span className="t-caption block text-stone-500 dark:text-zinc-400">
                        {frequencyLabel(problem.Frequency)}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <span className="tnum text-[13px] font-semibold text-stone-900 dark:text-zinc-100">
                        {formatAcceptance(problem["Acceptance Rate"])}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      {(problem.Topics ?? []).length === 0 ? (
                        <span className="t-caption text-stone-300 dark:text-zinc-600" aria-label="No topic data">—</span>
                      ) : (
                        <div className="flex max-w-80 flex-wrap gap-1">
                          {(problem.Topics ?? []).slice(0, 6).map((t) => (
                            <Badge key={t} variant="secondary" className="t-caption border-stone-200 bg-stone-100 px-1.5 py-0 font-medium text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                              {t}
                            </Badge>
                          ))}
                          {(problem.Topics ?? []).length > 6 && (
                            <Badge variant="outline" title={(problem.Topics ?? []).join(", ")} className="t-caption px-1.5 py-0 font-medium text-stone-500 dark:text-zinc-400">
                              +{(problem.Topics ?? []).length - 6}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 rounded-lg p-0 text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100" aria-label={`Open ${problem.Title} on LeetCode`}>
                        <a href={problem.Link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" aria-hidden />
                        </a>
                      </Button>
                    </TableCell>
                    <TableCell className="py-2.5 pr-5">
                      <button
                        type="button"
                        onClick={() => toggleSolved(problem.Link)}
                        aria-pressed={done}
                        aria-label={done ? `Mark ${problem.Title} as unsolved` : `Mark ${problem.Title} as solved`}
                        title={done ? "Solved — click to undo" : "Mark solved"}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-all hover:scale-110"
                        style={
                          done
                            ? { backgroundColor: "var(--accent)", boxShadow: "0 1px 4px rgb(0 0 0 / 0.25)" }
                            : undefined
                        }
                      >
                        {done ? (
                          <Check className="h-4 w-4 text-white dark:text-zinc-950" strokeWidth={3} aria-hidden />
                        ) : (
                          <Circle className="h-[22px] w-[22px] text-stone-300 transition-colors hover:text-stone-500 dark:text-zinc-600 dark:hover:text-zinc-300" aria-hidden />
                        )}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination — first/last, window, jump, density */}
      {filteredAndSorted.length > 0 && (
        <nav
          aria-label="Problem pages"
          className={cn("flex flex-col gap-2.5 border border-stone-200 bg-white px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900 lg:flex-row lg:items-center", cardRadius)}
        >
          <p className="t-caption tnum text-stone-500 dark:text-zinc-400">
            {filteredAndSorted.length === 0 ? "0" : startIndex + 1}–{Math.min(startIndex + pageSize, filteredAndSorted.length)} of{" "}
            {filteredAndSorted.length}
            {filteredAndSorted.length !== problems.length && ` (from ${problems.length})`}
            <span className="text-stone-300 dark:text-zinc-600"> · </span>page {safePage} of {totalPages}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:ml-auto">
            <label className="t-caption flex items-center gap-1.5 text-stone-500 dark:text-zinc-400">
              Rows
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(parseInt(v, 10));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger size="sm" className="w-[72px]" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={safePage === 1}
                className="h-9 w-9 rounded-lg p-0"
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(safePage - 1)}
                disabled={safePage === 1}
                className="h-9 w-9 rounded-lg p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (safePage <= 3) pageNum = i + 1;
                else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = safePage - 2 + i;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === safePage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="tnum h-9 w-9 rounded-lg p-0 text-[13px] font-semibold"
                    aria-label={`Page ${pageNum}`}
                    aria-current={pageNum === safePage ? "page" : undefined}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="h-9 w-9 rounded-lg p-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage === totalPages}
                className="h-9 w-9 rounded-lg p-0"
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {totalPages > 5 && (
              <form onSubmit={submitJump} className="flex items-center gap-1.5">
                <label htmlFor="jump-page" className="t-caption text-stone-500 dark:text-zinc-400">
                  Go to
                </label>
                <Input
                  id="jump-page"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={`${safePage}`}
                  value={jumpVal}
                  onChange={(e) => setJumpVal(e.target.value.replace(/[^0-9]/g, ""))}
                  aria-label={`Jump to page, 1 to ${totalPages}`}
                  className="tnum h-9 w-14 rounded-lg px-2 text-center text-base sm:text-[13px]"
                />
                <Button type="submit" variant="outline" size="sm" className="h-9 rounded-lg px-2.5 text-[13px] font-semibold" aria-label="Go to page">
                  Go
                </Button>
              </form>
            )}
            <button
              type="button"
              onClick={goToTop}
              className="t-caption inline-flex items-center gap-1 font-semibold text-stone-500 transition-colors hover:text-stone-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" aria-hidden />
              Top
            </button>
          </div>
        </nav>
      )}

      {filteredAndSorted.length === 0 && (
        <div
          className={cn("flex flex-col items-center border border-stone-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900", cardRadius)}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-zinc-800" aria-hidden>
            <Filter className="h-5 w-5 text-stone-500 dark:text-zinc-400" aria-hidden />
          </span>
          <h3 className="t-h2 mt-4 text-stone-900 dark:text-zinc-100">No matches</h3>
          <p className="t-small prose-measure mt-1.5 text-stone-600 dark:text-zinc-400">
            Nothing matches this combination of search and filters. Widen the search or clear a filter.
          </p>
          <Button variant="outline" onClick={clearFilters} className="mt-5 h-9 rounded-lg text-sm font-semibold">
            <X className="h-4 w-4" aria-hidden />
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  );
}
