# Company LeetCode Lists

Filter **700+ companies** by recency and frequency to focus your LeetCode interview prep.
Clean theme by default, with the original **Panda tribute theme** one toggle away.

Live: `https://panda-leetcode.vercel.app`

## How it works

```
CompanyCombobox + Time select (page.tsx)
  -> GET /api/getCompanies          -> merged canonical list (primary + fallback extras)
  -> GET /api/getProblems/[company]/[time]
       1. try PRIMARY  liquidslr/leetcode-company-wise-problems
          {Company}/1. Thirty Days.csv ... 5. All.csv
          (Difficulty, Title, Frequency, Acceptance Rate, Link, Topics)
       2. on failure/empty -> FALLBACK snehasishroy/leetcode-companywise-interview-questions
          {slug}/thirty-days.csv ... all.csv
          (ID, URL, Title, Difficulty, Acceptance %, Frequency % — no Topics)
       -> normalized { Company, Difficulty, Title, Frequency, Acceptance Rate, Link, Topics }
       -> { company, time, source: "primary" | "fallback", count, problems }
```

The UI shows a muted `Data: … (primary|fallback)` line under the controls so you always
know which dataset served the result.

## Data notes (read before grinding)

- **Frequency** is a *relative* tag frequency per company (100 = most-asked *there*),
  not a hiring probability. Tags are user-reported LeetCode Premium data — noisy for
  small companies.
- **Acceptance rates** from the primary source are currently stored ~100x too small
  upstream (e.g. `0.0058` instead of ~58%). The API repairs these heuristically; treat
  them as rough.
- **Fallback rows have no Topics.** Search/topic filter degrade gracefully with a notice.
- Recommended flow: **patterns first** (Blind 75 → Grind 75 → NeetCode 150, see the
  study-guide cards in-app), then the **Top-30 by frequency** for your target company
  in the last 30 days – 6 months. The app has a “Focus: Top 30” toggle for exactly this.
- Not affiliated with LeetCode.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build (tsc + eslint clean)
npm start
```

## Themes

- **Clean** (default): neutral slate + blue, WCAG-AA difficulty colors
  (Easy emerald / Medium amber / Hard rose), visible scrollbars, full keyboard support.
- **Panda** (tribute): original beige `#d3cac2` + tourmaline palette, rounded shapes,
  sparse floating pandas (hidden under `prefers-reduced-motion`).

Toggle persists to `localStorage` and syncs to `?theme=` for shareable links.
`?company=&time=` are also synced.

## Project structure

- `app/page.tsx` — controls, theme state, URL sync, source badge, footer
- `app/components/ProblemTable.tsx` — filters, sorting, pagination, solved tracking
- `app/components/CompanyCombobox.tsx` — searchable 700+ company picker
- `app/components/StudyGuides.tsx` — Blind 75 / Grind 75 / NeetCode 150 / LeetCode 75 cards
- `app/components/ThemeToggle.tsx` — Clean/Panda toggle
- `lib/sources.ts` — multi-source adapter, caching, normalization, validation
- `lib/theme.ts` — theme tokens + accessible difficulty colors
- `app/api/getCompanies/route.ts`, `app/api/getProblems/[company]/[time]/route.ts`
