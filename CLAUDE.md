@AGENTS.md

# Project notes

Personal, single-user job-search tool for the Swedish market. See README.md for what it does.

## Layout

- `lib/sources/` — one adapter per job site, all returning `RawJob[]`. Register new ones in `lib/sources/index.ts`.
- `lib/filters.ts` — rule-based filters that run before any model call. Fuzzy judgements belong in scoring, not here.
- `lib/llm.ts` — the `Llm` interface, shared prompts and schemas, and the Claude implementation. `lib/llm-gemini.ts` is the free-tier Gemini implementation; `lib/llm-provider.ts` picks one from the environment. Prompts and schemas are shared, so change them in one place.
- `lib/pipeline.ts` — the daily run: fetch → dedupe → filter → score → email. Entry points: `scripts/daily.ts`, `app/api/cron`, the "Search now" button.
- `lib/store.ts` — all SQL. `lib/db.ts` picks Postgres (`DATABASE_URL`) or embedded PGlite (`./.data`).
- `app/` — Next.js App Router pages; mutations are server actions in `app/actions.ts`.

## Design

Calm, warm Scandinavian minimalism. All tokens (palette, 8px spacing scale, radii, fonts) are CSS variables at the top of `app/globals.css`; use them, do not add colours.

- Fraunces for headings, Inter for body and UI, both self-hosted through `@fontsource-variable`.
- The forest-green accent is only for primary buttons, links and active states. No gradients, heavy shadows, emoji icons (use `lucide-react`) or harsh red.
- Scores: `components/ScoreRing.tsx` owns the scale (75+ "Great fit", 50–74 "Worth a look", below 50 "Long shot"). The ring carries the colour; numbers stay in the text colour for contrast.
- Show the score and the reasons (`components/Reasons.tsx`) before any long text. Full postings stay behind a click.
- Copy is warm and plain, in the voice of a thoughtful advisor ("we", "you").

## Conventions

- Raw SQL with `$n` parameters through `Db.query`; it must work on both `pg` and PGlite. Schema lives in `lib/db.ts` as idempotent `CREATE ... IF NOT EXISTS`.
- No scraping of sites that forbid it (Indeed, LinkedIn). Use public APIs/feeds and keep attribution ("via <source>") visible.
- Bump `SCORE_VERSION` in `lib/store.ts` when grading rules change enough that old grades mislead; untouched jobs are then re-graded.
- Seniority comes from the CV. Do not add a seniority setting.
- Run `npm test`, `npm run typecheck` and `npm run lint` before committing. Pipeline behaviour changes need a test in `tests/pipeline.test.ts`.
- In this cloud environment Node's `fetch` needs `NODE_USE_ENV_PROXY=1` to reach external hosts.
