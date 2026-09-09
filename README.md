# Company LeetCode Lists

Filter **700+ companies** by recency and frequency to focus your LeetCode interview prep.
Ships with **Light / Dark / Panda** themes (icon picker in the header, persisted + URL-synced).

Live: `https://panda-leetcode.vercel.app`

## How it works

```
CompanyCombobox (multi, up to 5) + Time select (page.tsx)
  -> GET /api/getCompanies          -> merged canonical list (primary + fallback extras)
                                        + real upstream commit dates ("data as of")
  -> GET /api/getProblems/[company]/[time]  (one call per selected company, in parallel)
       1. try PRIMARY  liquidslr/leetcode-company-wise-problems
          {Company}/1. Thirty Days.csv ... 5. All.csv
          (Difficulty, Title, Frequency, Acceptance Rate, Link, Topics)
       2. on failure/empty -> FALLBACK snehasishroy/leetcode-companywise-interview-questions
          {slug}/thirty-days.csv ... all.csv
          (ID, URL, Title, Difficulty, Acceptance %, Frequency % — no Topics)
       -> normalized { Company, Difficulty, Title, Frequency, Acceptance Rate, Link, Topics }
       -> { company, time, source: "primary" | "fallback", count, problems }
  -> client merge (lib/merge.ts): dedupe by link, max frequency wins,
     display fields follow the highest-frequency source (ties: alphabetical),
     topics + company lists unioned
```

The UI shows a muted `src · … · data as of …` line under the controls so you always
know which dataset served the result and how fresh it is.

## Shareable links

State syncs to the URL, so any view can be bookmarked or shared:

```
?company=Google&company=Meta&time=Thirty+Days&theme=dark
```

- `company` — repeatable, up to 5 (unknown names are ignored on load)
- `time` — one of `Thirty Days`, `Three Months`, `Six Months`, `More Than Six Months`, `All`
- `theme` — `clean`, `dark`, or `panda`
- `autoload=0` — present companies but don't auto-fetch (default fetches)

## Data notes (read before grinding)

- **Frequency** is a *relative* tag frequency per company (100 = most-asked *there*),
  not a hiring probability. Tags are user-reported LeetCode Premium data — noisy for
  small companies. Frequency bands in the UI ("Very high"…) are editorial labels for
  the current result set, not statistics.
- **Acceptance rates** from the primary source are currently stored ~100x too small
  upstream (e.g. `0.0058` instead of ~58%). The API repairs these heuristically; treat
  them as rough.
- **Fallback rows have no Topics.** Search/topic filter degrade gracefully with a notice.
- Recommended flow: **patterns first** (Blind 75 → Grind 75 → NeetCode 150, see the
  study-guide cards in-app), then the **Top-30 by frequency** for your target company
  in the last 30 days – 6 months. The app has a “Focus: Top 30” toggle for exactly this.
- Not affiliated with LeetCode.

## Getting Started (Bun)

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
bun run test    # vitest: normalize + merge unit tests
bun run lint
bunx tsc --noEmit
bun run build   # production build (Turbopack, default in Next 16)
bun run start
```

## Toolchain (tracked)

| Package | Version | Notes |
|---|---|---|
| `next` | 16.3.4 | Migrated from 15.5.0; Turbopack default dev+build, async `params` already awaited |
| `react` / `react-dom` | 19.2.8 | Bumped with Next 16 (React canary line) |
| `eslint-config-next` | 16.3.4 | Native flat config — the old FlatCompat shim broke (`set-state-in-effect` now enforced; effects refactored, not silenced) |
| `@types/react` / `@types/react-dom` | 19.2.x | Match React 19.2 |
| Node floor | 20.9+ | Per Next 16 requirements (dev here: Node 22, Bun 1.4) |

CI (`.github/workflows/ci.yml`) runs install, typecheck, lint, tests, and build on
every push/PR to `main`. `bun.lock` is the single source of truth — no `package-lock.json`.

## Themes

- **Light** (default): warm paper background, white cards, indigo accent.
- **Dark**: zinc surfaces, white primary buttons, indigo-400 accent.
- **Panda** (tribute): original beige `#d3cac2` + tourmaline palette, rounded shapes,
  sparse floating pandas (hidden under `prefers-reduced-motion`).

Difficulty colors are WCAG-AA in both modes (Easy emerald / Medium amber / Hard rose).
Toggle persists to `localStorage` and syncs to `?theme=`.

## Project structure

- `app/page.tsx` — controls, theme state, URL sync, source badge, footer
- `app/components/ProblemTable.tsx` — filters, multi-sort, pagination, solved tracking, CSV export
- `app/components/CompanyCombobox.tsx` — searchable multi-company picker (up to 5)
- `app/components/TopicMultiSelect.tsx` — searchable multi-topic picker
- `app/components/StudyGuides.tsx` — Blind 75 / Grind 75 / NeetCode 150 / LeetCode 75 cards
- `app/components/ThemeToggle.tsx` — Light/Dark/Panda icon picker
- `lib/sources.ts` — multi-source adapter, caching, normalization, validation (+ tests)
- `lib/merge.ts` — deterministic multi-company merge (+ tests)
- `lib/theme.ts` — theme tokens + accessible difficulty colors
- `app/api/getCompanies/route.ts`, `app/api/getProblems/[company]/[time]/route.ts`
