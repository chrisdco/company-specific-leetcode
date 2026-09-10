"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Hash, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Searchable multi-select for topics - mirrors the company picker idiom:
 * type to narrow, toggle to select, chips/pills show what's active.
 */
export default function TopicMultiSelect({
  topics,
  selected,
  onChange,
}: {
  topics: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Focusing the panel search is a genuine external-DOM sync: this effect
  // writes no state, so it stays within the rules.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open ]);

  function openPanel() {
    // Reset + prune at open-time (event handler, not an effect): typing
    // filters immediately and stale selections from a previous result set go.
    setQuery("");
    setHighlight(0);
    const valid = new Set(topics);
    if (selected.some((s) => !valid.has(s))) {
      onChange(selected.filter((s) => valid.has(s)));
    }
    setOpen(true);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => t.toLowerCase().includes(q));
  }, [topics, query]);

  // Keep the highlighted option visible while arrowing.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function toggle(t: string) {
    onChange(
      selected.includes(t) ? selected.filter((s) => s !== t) : [...selected, t]
    );
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger + clear are siblings (a button inside a button is invalid HTML). */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? close(false) : openPanel())}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) close(true);
          }}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`Filter by topic${selected.length > 0 ? `, ${selected.length} selected` : ""}`}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border bg-transparent px-3 text-sm font-medium shadow-xs transition-colors sm:w-44",
            "border-stone-200 text-stone-700 hover:bg-stone-50 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800/60",
            selected.length > 0 && "font-semibold"
          )}
          style={selected.length > 0 ? { borderColor: "var(--accent)", color: "var(--accent)", paddingRight: "2.25rem" } : undefined}
        >
          <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          <span className="flex-1 truncate text-left">
            {selected.length === 0 ? "All topics" : selected.length === 1 ? selected[0] : `${selected.length} topics`}
          </span>
          {selected.length === 0 && (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
          )}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            aria-label="Clear topic filter"
            onClick={() => onChange([])}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--accent)" }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1.5 max-h-80 w-64 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="relative border-b border-stone-100 p-2 dark:border-zinc-800">
            <Search
              className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500 dark:text-zinc-400"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              role="combobox"
              aria-expanded="true"
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                  if (filtered[highlight]) {
                    e.preventDefault();
                    toggle(filtered[highlight]);
                  }
                } else if (e.key === "Escape") {
                  close(true);
                }
              }}
              placeholder="Search topics…"
              aria-label="Search topics"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={filtered.length > 0 ? `${listId}-opt-${Math.min(highlight, filtered.length - 1)}` : undefined}
              className="h-9 rounded-lg pl-8 text-base sm:text-sm"
            />
          </div>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable
            aria-label="Topics"
            className="max-h-56 overflow-auto p-1"
          >
            {filtered.length === 0 ? (
              <li className="t-small px-3 py-5 text-center text-stone-500 dark:text-zinc-400">
                No topics match “{query}”.
              </li>
            ) : (
              filtered.map((t, i) => {
                const isSel = selected.includes(t);
                const hot = i === highlight;
                return (
                  <li key={t} id={`${listId}-opt-${i}`} role="option" aria-selected={isSel}>
                    <button
                      type="button"
                      data-idx={i}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => toggle(t)}
                      className={cn(
                        "t-small flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left transition-colors [@media(pointer:coarse)]:min-h-11",
                        isSel
                          ? "font-semibold"
                          : hot
                            ? "bg-stone-100 text-stone-900 dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-stone-700 dark:text-zinc-300"
                      )}
                      style={isSel ? { backgroundColor: "var(--accentSoft)", color: "var(--accent)" } : undefined}
                    >
                      <span className="truncate">{t}</span>
                      {isSel && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {selected.length > 0 && (
            <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2 dark:border-zinc-800">
              <span className="t-caption tnum text-stone-500 dark:text-zinc-400">
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="t-caption font-semibold text-stone-500 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
