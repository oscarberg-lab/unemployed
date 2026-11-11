# unemployed

A personal job-search tool. Upload your CV, choose where you want to work, and once a day it
collects new postings, grades each one against your profile, and emails you the best matches.

Built for the Swedish job market, with optional international jobs that are strictly remote.

## What it does

- **Reads your CV** (PDF or text) into a profile: skills, experience, languages and seniority. Seniority is derived, never asked.
- **Location**: add cities, each with a travel radius in km. Remote-flagged jobs elsewhere in Sweden are included if you accept remote work.
- **Fields of work**: the Swedish search is restricted to your occupation fields (suggested from the CV, editable). Jobs in another profession, or that require a licence or qualification you lack, are hidden.
- **Preferences**: work mode, working hours, contract type, minimum salary, industries to avoid, companies to exclude, free-text notes.
- **Daily search** across sources, then: remove duplicates → cheap rule filters → grade the rest with an AI model (0–100, with sub-scores for skills, seniority, location and preferences, a short reason and the gaps).
- **Feedback**: "Interested" / "Not for me" (with an optional reason) is fed into later grading.
- **Tracker**: saved → applied → interview → offer / rejected, with notes per job.
- **Skill gaps**: the requirements you most often lack in jobs that otherwise fit.
- **Cover letters**: a tailored draft per job, on demand, in the language of the posting.

## Sources

| Source | Covers | Notes |
|---|---|---|
| Arbetsförmedlingen (JobTech JobSearch API) | Sweden | Open API, no key. Searched by job title and distance. |
| Jobicy | International remote | Feed pre-filtered to roles open to people in Sweden. |
| Remotive | International remote | Small free feed; one request per run as their terms ask. |

Adding a site means writing one adapter in `lib/sources/` and listing it in `lib/sources/index.ts`.
Indeed and LinkedIn are deliberately not scraped.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then put your GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in it
npm run dev
```

Open http://localhost:3000, upload your CV, set your places and preferences, and press **Search now**.
With no `DATABASE_URL`, data lives in `./.data` (an embedded Postgres), so nothing else needs installing.

## Make it run every day

The search needs a database that is reachable from wherever the schedule runs:

1. Create a free Postgres database (for example Neon or Supabase) and copy its connection string.
2. In this GitHub repository, add the secrets `DATABASE_URL` and `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY`)
   (Settings → Secrets and variables → Actions). For the email digest also add `RESEND_API_KEY` and `DIGEST_TO`.
3. The workflow in `.github/workflows/daily.yml` then runs `npm run daily` every morning. Until the secrets exist it skips itself.
4. Use the same `DATABASE_URL` in `.env.local` (or in your hosting provider) so the web app shows the same data.

If you host the web app (for example on Vercel), set `APP_PASSWORD` so the pages are not public.
Hosts with their own scheduler can call `GET /api/cron` with `Authorization: Bearer $CRON_SECRET` instead of using the GitHub workflow.

## Which AI model does the work

| | Google Gemini (free tier) | Claude |
|---|---|---|
| Setting | `GEMINI_API_KEY` | `ANTHROPIC_API_KEY` (wins if both are set, unless `LLM_PROVIDER=gemini`) |
| Cost | Free | Pay per use; set `LLM_MODEL=claude-haiku-5-5` to keep it very low |
| Speed | One posting about every 5 seconds, to stay under the free per-minute limit | Four at a time |
| Limits | A daily request quota per model. When it runs out, the remaining postings wait for the next run. | None in practice |

Each run grades at most `MAX_SCORED_PER_RUN` new postings (default 40); the rest wait for the next run.
The "Search now" button stops grading after four minutes so the page does not time out; the daily run has no such limit.

Check Google's current terms for how free-tier data is used before uploading your CV.

## Development

```bash
npm test          # filters, source mapping, and the whole pipeline against an in-memory database
npm run typecheck
npm run lint
```
