"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const MAX_COMPANIES = 5;

export default function CompanyCombobox({
  companies,
  selected,
  onChange,
  disabled,
}: {
  companies: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const atMax = selected.length >= MAX_COMPANIES;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? (() => {
          const starts: string[] = [];
          const contains: string[] = [];
          for (const c of companies) {
            const l = c.toLowerCase();
            if (l.startsWith(q)) starts.push(c);
            else if (l.includes(q)) contains.push(c);
            if (starts.length + contains.length > 200) break;
          }
          return [...starts.slice(0, 100), ...contains.slice(0, 100)].slice(0, 120);
        })()
      : companies.slice(0, 100);
    return pool;
  }, [companies, query]);

  // Derive the clamped index during render instead of syncing it in an
  // effect — resetting to 0 on every keypress felt broken, and clamping on
  // read keeps a single source of truth without cascading renders.
  const safeHighlight =
    filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  function toggle(c: string) {
    if (selected.includes(c)) {
      onChange(selected.filter((s) => s !== c));
    } else {
      if (selected.length >= MAX_COMPANIES) return;
      onChange([...selected, c]);
    }
    setQuery("");
  }

  function remove(c: string) {
    onChange(selected.filter((s) => s !== c));
  }

  return (
    <div ref={rootRef} className="relative">
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Selected companies">
          {selected.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-lg border border-transparent py-1 pl-2.5 pr-1.5 text-[13px] font-semibold"
              style={{ backgroundColor: "var(--accentSoft)", color: "var(--accent)" }}
            >
              {c}
              <button
                type="button"
                onClick={() => remove(c)}
                aria-label={`Remove ${c}`}
                className="rounded-md p-0.5 transition-colors hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <span className="t-caption self-center text-stone-400 dark:text-zinc-500">
            {selected.length}/{MAX_COMPANIES}
          </span>
        </div>
      )}
      <div className="relative">
        <Building2
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500"
          aria-hidden
        />
        <Input
          id="company-search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={`Companies — type to search ${companies.length} companies, pick up to ${MAX_COMPANIES}`}
          placeholder={
            companies.length
              ? selected.length === 0
                ? `Search ${companies.length} companies…`
                : "Add another company…"
              : "Loading companies…"
          }
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              // Prefer an exact match over whatever happens to be highlighted —
              // typing a full name + Enter must not add a different prefix hit.
              const exact = query.trim()
                ? companies.find((c) => c.toLowerCase() === query.trim().toLowerCase())
                : undefined;
              if (exact && (!open || filtered.includes(exact))) {
                e.preventDefault();
                toggle(exact);
              } else if (open && filtered[safeHighlight]) {
                e.preventDefault();
                toggle(filtered[safeHighlight]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !query && selected.length > 0) {
              remove(selected[selected.length - 1]);
            }
          }}
          className="h-10 rounded-lg pl-9 pr-9 text-base sm:text-sm"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500"
          aria-hidden
        />
      </div>
      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {atMax && (
            <p className="t-caption border-b border-stone-100 px-4 py-2 font-medium dark:border-zinc-800" style={{ backgroundColor: "var(--accentSoft)", color: "var(--accent)" }}>
              {MAX_COMPANIES} companies selected — remove one to add another.
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="t-small flex items-center gap-2 px-4 py-6 text-stone-500 dark:text-zinc-400">
              <Search className="h-4 w-4" aria-hidden />
              No companies match “{query}”.
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-multiselectable aria-label="Companies" className="p-1">
              {filtered.map((c, i) => {
                const isSel = selected.includes(c);
                const active = i === safeHighlight;
                return (
                  <li key={c} role="option" aria-selected={isSel}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => toggle(c)}
                      disabled={!isSel && atMax}
                      className={cn(
                        "t-small flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-40 [@media(pointer:coarse)]:min-h-11",
                        active ? "bg-stone-100 text-stone-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-stone-700 dark:text-zinc-300"
                      )}
                    >
                      <span className="truncate font-medium">{c}</span>
                      {isSel && <Check className="h-4 w-4 shrink-0" aria-hidden style={{ color: "var(--accent)" }} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {companies.length > 120 && !query && (
            <p className="t-caption border-t border-stone-100 px-4 py-2 text-stone-400 dark:border-zinc-800 dark:text-zinc-500">
              Showing first 100 — type to search all {companies.length}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
