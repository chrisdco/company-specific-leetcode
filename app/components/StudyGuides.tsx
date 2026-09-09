"use client";

import { ExternalLink, ListOrdered, Video } from "lucide-react";

const GUIDES = [
  {
    name: "Blind 75",
    count: "75 problems",
    time: "~40h · 2–4 weeks",
    blurb: "The original classic. One problem per pattern — fastest route to pattern recognition.",
    bestFor: "Under 3 weeks",
    href: "https://neetcode.io/practice?tab=blind75",
  },
  {
    name: "Grind 75",
    count: "75 problems",
    time: "~40h · customizable",
    blurb: "Same author's successor. Ordered by difficulty with time estimates + weekly planner.",
    bestFor: "Tight deadline",
    href: "https://www.techinterviewhandbook.org/grind75/",
  },
  {
    name: "NeetCode 150",
    count: "150 problems",
    time: "~85–100h · 6–8 weeks",
    blurb: "Blind 75 + 75 variations. Adds Greedy, Backtracking, advanced Graphs. Free videos.",
    bestFor: "6+ weeks",
    href: "https://neetcode.io/practice?tab=neetcode150",
  },
  {
    name: "LeetCode 75 + Top 150",
    count: "75 / 150 problems",
    time: "Official study plans",
    blurb: "LeetCode's own curated plans with progress tracking. Good structured alternative.",
    bestFor: "Platform-native",
    href: "https://leetcode.com/studyplan/leetcode-75/",
  },
];

export default function StudyGuides() {
  return (
    <section aria-labelledby="study-guides-heading" className="mt-8">
      <p className="t-eyebrow text-stone-400 dark:text-zinc-500">Study path</p>
      <h2 id="study-guides-heading" className="t-h2 mt-1 text-stone-900 dark:text-zinc-100">
        Learn patterns first, then target companies
      </h2>
      <p className="t-small prose-measure mt-1.5 text-stone-600 dark:text-zinc-400">
        Company lists work best as a <strong className="font-semibold text-stone-800 dark:text-zinc-200">final 3–4 week filter</strong>,
        not a starting point. Build pattern recognition with one list below, then come back and
        grind the top 20–30 high-frequency problems for your target company.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GUIDES.map((g) => (
          <a
            key={g.name}
            href={g.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-xl border border-stone-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="t-h3 flex items-center gap-1.5 text-stone-900 dark:text-zinc-100">
                <ListOrdered className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" aria-hidden />
                {g.name}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-300 transition-colors group-hover:text-stone-500 dark:text-zinc-600 dark:group-hover:text-zinc-300" aria-hidden />
            </div>
            <p className="t-mono mt-1.5 text-[11.5px] text-stone-400 dark:text-zinc-500">
              {g.count} · {g.time}
            </p>
            <p className="t-small mt-2 text-stone-600 dark:text-zinc-400">{g.blurb}</p>
            <p className="t-caption mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 font-semibold text-stone-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Video className="h-3 w-3" aria-hidden />
              Best for: {g.bestFor}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
