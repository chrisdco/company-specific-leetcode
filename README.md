# Company LeetCode Lists

Stop grinding random problems. Pick up to 5 companies, filter by recency and
frequency, and prep against what they actually ask.

### **[Try it live →](https://panda-leetcode.vercel.app)**

- 🎯 Company-tagged questions across **700+ companies**, with real data-freshness dates
- 📊 Sortable frequency + acceptance stats, topic filters, per-company compare view
- 🌓 Light / Dark / Panda themes — every view is a shareable link
- ✅ Solved tracking, Top-30 focus mode, one-click CSV export

> Frequency means "how often this is tagged for *that* company" (100 = its most-asked),
> not a hiring probability. Tags are user-reported, so small-company lists are noisy.
> Not affiliated with LeetCode.

## Developers

```bash
bun install && bun run dev      # http://localhost:3000
bun run test && bun run lint    # vitest + eslint
bun run build                   # production build (Next 16 + Turbopack)
```

- `bun.lock` is the only lockfile. CI runs install → typecheck → lint → test → build.
- Data comes from two upstream CSV datasets (primary + fallback), normalized in
  `lib/sources.ts` with quota-friendly caching (ETag revalidation, dedup, honest 429s).
- Key files: `app/page.tsx` (controls + state) · `app/components/ProblemTable.tsx`
  (table, filters, sorting) · `lib/merge.ts` (multi-company merge) · `lib/theme.ts`.

Forks and PRs welcome — please keep `bun run build` green.
