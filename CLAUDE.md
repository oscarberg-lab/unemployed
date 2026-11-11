@AGENTS.md

# Project notes

Personal, single-user job-search tool for the Swedish market. See README.md for what it does.

## Layout

- `lib/sources/` — one adapter per job site, all returning `RawJob[]`. Register new ones in `lib/sources/index.ts`.
- `lib/filters.ts` — rule-based filters that run before any model call. Fuzzy judgements belong in scoring, not here.
- `lib/llm.ts` — every Claude call (CV parsing, job scoring, cover letters) behind the `Llm` interface so tests can fake it.
- `lib/pipeline.ts` — the daily run: fetch → dedupe → filter → score → email. Entry points: `scripts/daily.ts`, `app/api/cron`, the "Search now" button.
- `lib/store.ts` — all SQL. `lib/db.ts` picks Postgres (`DATABASE_URL`) or embedded PGlite (`./.data`).
- `app/` — Next.js App Router pages; mutations are server actions in `app/actions.ts`.

## Conventions

- Raw SQL with `$n` parameters through `Db.query`; it must work on both `pg` and PGlite. Schema lives in `lib/db.ts` as idempotent `CREATE ... IF NOT EXISTS`.
- No scraping of sites that forbid it (Indeed, LinkedIn). Use public APIs/feeds and keep attribution ("via <source>") visible.
- Seniority comes from the CV. Do not add a seniority setting.
- Run `npm test`, `npm run typecheck` and `npm run lint` before committing. Pipeline behaviour changes need a test in `tests/pipeline.test.ts`.
- In this cloud environment Node's `fetch` needs `NODE_USE_ENV_PROXY=1` to reach external hosts.
