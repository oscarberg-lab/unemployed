import { sendDigest } from "./email";
import { dedupe, hardFilter } from "./filters";
import { isConfigError, LlmQuotaError, type Llm } from "./llm";
import { getLlm } from "./llm-provider";
import { SOURCES } from "./sources";
import type { Source } from "./sources/types";
import * as store from "./store";
import { dedupeKey } from "./text";
import type { JobRow, RawJob } from "./types";

export interface PipelineDeps {
  sources?: Source[];
  llm?: Llm;
  sendDigest?: (jobs: JobRow[]) => Promise<boolean>;
  maxScored?: number;
  /** Stop starting new scoring calls after this long, so a web request is not cut off mid-run. */
  timeBudgetMs?: number;
}

async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

/** The daily job: fetch -> dedupe -> hard-filter -> score -> notify. Safe to run more than once a day. */
export async function runPipeline(deps: PipelineDeps = {}): Promise<store.RunStats> {
  const { profile, prefs } = await store.getSettings();
  if (!profile) throw new Error("Upload a CV first.");
  if (!prefs.searchTerms.length) throw new Error("Add at least one search term in your preferences.");

  const sources = deps.sources ?? SOURCES;
  const maxScored = deps.maxScored ?? Number(process.env.MAX_SCORED_PER_RUN ?? 40);
  const stats: store.RunStats = { fetched: 0, new: 0, filtered: 0, scored: 0, failed: 0, emailed: 0, sourceErrors: [] };
  const runId = await store.startRun();

  try {
    // The first run looks further back so the list is not empty on day one.
    const maxAgeDays = (await store.hasSuccessfulRun()) ? 3 : 14;

    const fetched: RawJob[] = [];
    for (const source of sources.filter((s) => s.enabled(prefs))) {
      try {
        fetched.push(...(await source.fetch({ prefs, maxAgeDays })));
      } catch (err) {
        // One site being down must not stop the others.
        stats.sourceErrors.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    stats.fetched = fetched.length;

    const unique = dedupe(fetched);
    const known = await store.knownJobs(unique);
    const fresh = unique.filter((j) => !known.has(store.jobId(j)) && !known.has(dedupeKey(j)));
    stats.new = fresh.length;

    for (const job of fresh) {
      const reason = hardFilter(job, prefs);
      if (reason) stats.filtered++;
      await store.insertJob(job, reason);
    }

    // Score the newest unscored jobs. Anything over the cap waits for the next run.
    const pending = await store.pendingJobs(maxScored);
    if (pending.length) {
      const llm = deps.llm ?? getLlm();
      const ctx = { profile, prefs, feedback: await store.feedbackExamples() };
      const deadline = deps.timeBudgetMs ? Date.now() + deps.timeBudgetMs : Infinity;
      let paused: string | null = null;
      await pool(pending, llm.concurrency ?? 4, async (row) => {
        if (paused) return;
        if (Date.now() > deadline) {
          paused = "scoring paused to stay within the time limit; the rest are scored on the next run";
          return;
        }
        try {
          const score = await llm.scoreJob(ctx, store.toRawJob(row));
          const reason = row.region === "INTL" && !score.strictlyRemoteFromSweden ? "not strictly remote from Sweden" : null;
          await store.saveScore(row.id, score, reason);
          stats.scored++;
          if (reason) stats.filtered++;
        } catch (err) {
          // Bad credentials are not the job's fault: stop the run without using up its retries.
          if (isConfigError(err)) throw err;
          // Out of quota: keep what was scored and leave the rest for the next run.
          if (err instanceof LlmQuotaError) {
            paused = `${err.message} The rest are scored on the next run`;
            return;
          }
          console.error(`Scoring failed for ${row.id}:`, err);
          await store.noteScoreFailure(row.id);
          stats.failed++;
        }
      });
      if (paused) stats.sourceErrors.push(paused);
    }

    const digest = await store.digestJobs(prefs.digestMinScore);
    try {
      if (await (deps.sendDigest ?? sendDigest)(digest)) {
        await store.markNotified(digest.map((j) => j.id));
        stats.emailed = digest.length;
      }
    } catch (err) {
      stats.sourceErrors.push(`email: ${err instanceof Error ? err.message : String(err)}`);
    }

    await store.finishRun(runId, stats, null);
    return stats;
  } catch (err) {
    await store.finishRun(runId, stats, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
