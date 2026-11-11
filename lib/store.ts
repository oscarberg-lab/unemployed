import { getDb } from "./db";
import { dedupeKey } from "./text";
import { DEFAULT_PREFS, type FeedbackExample, type JobRow, type JobScore, type Preferences, type Profile, type RawJob, type Status } from "./types";

export interface Settings {
  profile: Profile | null;
  cvFilename: string | null;
  prefs: Preferences;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const [row] = await db.query<{ profile: Profile | null; cv_filename: string | null; prefs: Partial<Preferences> | null }>(
    "SELECT profile, cv_filename, prefs FROM settings WHERE id = 1",
  );
  return {
    profile: row?.profile ?? null,
    cvFilename: row?.cv_filename ?? null,
    prefs: { ...DEFAULT_PREFS, ...(row?.prefs ?? {}) },
  };
}

export async function saveProfile(profile: Profile, cvFilename: string): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO settings (id, profile, cv_filename) VALUES (1, $1::jsonb, $2)
     ON CONFLICT (id) DO UPDATE SET profile = EXCLUDED.profile, cv_filename = EXCLUDED.cv_filename, updated_at = now()`,
    [JSON.stringify(profile), cvFilename],
  );
}

export async function savePrefs(prefs: Preferences): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO settings (id, prefs) VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()`,
    [JSON.stringify(prefs)],
  );
}

export const jobId = (job: RawJob) => `${job.source}:${job.externalId}`;

/** Which of these postings (by id or by cross-site duplicate key) have we stored before? */
export async function knownJobs(jobs: RawJob[]): Promise<Set<string>> {
  if (!jobs.length) return new Set();
  const db = await getDb();
  const rows = await db.query<{ id: string; dedupe_key: string }>(
    "SELECT id, dedupe_key FROM jobs WHERE id = ANY($1::text[]) OR dedupe_key = ANY($2::text[])",
    [jobs.map(jobId), jobs.map(dedupeKey)],
  );
  return new Set(rows.flatMap((r) => [r.id, r.dedupe_key]));
}

export async function insertJob(job: RawJob, filteredReason: string | null): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO jobs (id, source, title, company, url, description, region, location, lat, lon, remote,
                       eligible_regions, working_hours, contract_type, salary, deadline, published_at, dedupe_key, filtered_reason,
                       occupation, occupation_field)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (id) DO NOTHING`,
    [
      jobId(job), job.source, job.title, job.company, job.url, job.description, job.region, job.location, job.lat, job.lon,
      job.remote, job.eligibleRegions, job.workingHours, job.contractType, job.salary, job.deadline, job.publishedAt,
      dedupeKey(job), filteredReason, job.occupation, job.occupationField,
    ],
  );
}

interface StoredJob extends JobRow {
  lat: number | null;
  lon: number | null;
}

export function toRawJob(row: StoredJob): RawJob {
  return {
    source: row.source,
    externalId: row.id.slice(row.source.length + 1),
    title: row.title,
    company: row.company,
    url: row.url,
    description: row.description,
    region: row.region,
    location: row.location,
    lat: row.lat,
    lon: row.lon,
    remote: row.remote,
    occupation: row.occupation,
    occupationField: row.occupation_field,
    eligibleRegions: row.eligible_regions,
    workingHours: row.working_hours as RawJob["workingHours"],
    contractType: row.contract_type as RawJob["contractType"],
    salary: row.salary,
    deadline: row.deadline?.toISOString() ?? null,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

export async function pendingJobs(limit: number): Promise<StoredJob[]> {
  const db = await getDb();
  return db.query<StoredJob>(
    `SELECT * FROM jobs WHERE score IS NULL AND filtered_reason IS NULL AND score_attempts < 3
     ORDER BY published_at DESC NULLS LAST LIMIT $1`,
    [limit],
  );
}

export async function saveScore(id: string, s: JobScore, filteredReason: string | null): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE jobs SET score = $2, subscores = $3::jsonb, summary = $4, strengths = $5::jsonb, gaps = $6::jsonb,
                     work_mode = $7, filtered_reason = $8, scored_at = now(), score_version = ${SCORE_VERSION} WHERE id = $1`,
    [id, s.score, JSON.stringify(s.subscores), s.summary, JSON.stringify(s.strengths), JSON.stringify(s.gaps), s.workMode, filteredReason],
  );
}

/**
 * Bump when grading changes enough that old grades are misleading. Untouched jobs graded under an
 * older version are sent back to the queue; anything the user saved, applied to or rated is left alone.
 */
export const SCORE_VERSION = 2;

export async function requeueOutdatedScores(): Promise<number> {
  const db = await getDb();
  const rows = await db.query(
    `UPDATE jobs SET score = NULL, score_attempts = 0
     WHERE score IS NOT NULL AND score_version < ${SCORE_VERSION} AND status = 'new' AND feedback IS NULL AND filtered_reason IS NULL
     RETURNING id`,
  );
  return rows.length;
}

export async function noteScoreFailure(id: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE jobs SET score_attempts = score_attempts + 1 WHERE id = $1", [id]);
}

export async function feedbackExamples(limit = 12): Promise<FeedbackExample[]> {
  const db = await getDb();
  const rows = await db.query<{ title: string; company: string; feedback: "up" | "down"; feedback_note: string | null }>(
    `(SELECT title, company, feedback, feedback_note, feedback_at FROM jobs WHERE feedback = 'up' ORDER BY feedback_at DESC LIMIT $1)
     UNION ALL
     (SELECT title, company, feedback, feedback_note, feedback_at FROM jobs WHERE feedback = 'down' ORDER BY feedback_at DESC LIMIT $1)`,
    [limit],
  );
  return rows.map((r) => ({ title: r.title, company: r.company, feedback: r.feedback, note: r.feedback_note }));
}

export type JobView = "matches" | "all" | "dismissed";

export async function listJobs(view: JobView, minScore: number): Promise<JobRow[]> {
  const db = await getDb();
  const where =
    view === "matches"
      ? "status = 'new' AND score >= $1"
      : view === "dismissed"
        ? "status = 'dismissed' AND score >= $1"
        : "status <> 'dismissed' AND score >= $1";
  return db.query<JobRow>(
    `SELECT * FROM jobs WHERE filtered_reason IS NULL AND score IS NOT NULL AND ${where}
     ORDER BY score DESC, published_at DESC NULLS LAST LIMIT 200`,
    [minScore],
  );
}

export async function trackedJobs(): Promise<JobRow[]> {
  const db = await getDb();
  return db.query<JobRow>(
    "SELECT * FROM jobs WHERE status IN ('saved','applied','interview','offer','rejected') ORDER BY score DESC NULLS LAST",
  );
}

export async function getJob(id: string): Promise<StoredJob | null> {
  const db = await getDb();
  const [row] = await db.query<StoredJob>("SELECT * FROM jobs WHERE id = $1", [id]);
  return row ?? null;
}

export async function setStatus(id: string, status: Status): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE jobs SET status = $2 WHERE id = $1", [id, status]);
}

export async function setFeedback(id: string, feedback: "up" | "down" | null, note: string | null): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE jobs SET feedback = $2, feedback_note = $3, feedback_at = now(),
       status = CASE WHEN $2 = 'down' THEN 'dismissed' WHEN $2 = 'up' AND status IN ('new','dismissed') THEN 'saved' ELSE status END
     WHERE id = $1`,
    [id, feedback, note],
  );
}

export async function setNotes(id: string, notes: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE jobs SET notes = $2 WHERE id = $1", [id, notes]);
}

export async function setCoverLetter(id: string, letter: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE jobs SET cover_letter = $2 WHERE id = $1", [id, letter]);
}

export async function digestJobs(minScore: number): Promise<JobRow[]> {
  const db = await getDb();
  return db.query<JobRow>(
    `SELECT * FROM jobs WHERE filtered_reason IS NULL AND notified = false AND status = 'new' AND score >= $1
     ORDER BY score DESC LIMIT 15`,
    [minScore],
  );
}

export async function markNotified(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await getDb();
  await db.query("UPDATE jobs SET notified = true WHERE id = ANY($1::text[])", [ids]);
}

/** Requirements that keep showing up in near-miss jobs: what to learn next. */
export async function gapCounts(minScore = 50): Promise<{ gap: string; count: number; examples: string[] }[]> {
  const db = await getDb();
  const rows = await db.query<{ title: string; gaps: string[] | null }>(
    "SELECT title, gaps FROM jobs WHERE filtered_reason IS NULL AND score >= $1 AND status <> 'dismissed'",
    [minScore],
  );
  const map = new Map<string, { gap: string; count: number; examples: string[] }>();
  for (const row of rows) {
    for (const gap of new Set((row.gaps ?? []).map((g) => g.trim()).filter(Boolean))) {
      const key = gap.toLowerCase();
      const entry = map.get(key) ?? { gap, count: 0, examples: [] };
      entry.count++;
      if (entry.examples.length < 3) entry.examples.push(row.title);
      map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface RunStats {
  fetched: number;
  new: number;
  filtered: number;
  scored: number;
  failed: number;
  emailed: number;
  sourceErrors: string[];
}

export async function hasSuccessfulRun(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query("SELECT 1 FROM runs WHERE finished_at IS NOT NULL AND error IS NULL LIMIT 1");
  return rows.length > 0;
}

export async function startRun(): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ id: number }>("INSERT INTO runs DEFAULT VALUES RETURNING id");
  return row.id;
}

export async function finishRun(id: number, stats: RunStats | null, error: string | null): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE runs SET finished_at = now(), stats = $2::jsonb, error = $3 WHERE id = $1", [
    id,
    stats ? JSON.stringify(stats) : null,
    error,
  ]);
}

export async function lastRun(): Promise<{ started_at: Date; finished_at: Date | null; stats: RunStats | null; error: string | null } | null> {
  const db = await getDb();
  const [row] = await db.query<{ started_at: Date; finished_at: Date | null; stats: RunStats | null; error: string | null }>(
    "SELECT started_at, finished_at, stats, error FROM runs ORDER BY id DESC LIMIT 1",
  );
  return row ?? null;
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM jobs WHERE score IS NULL AND filtered_reason IS NULL AND score_attempts < 3",
  );
  return row.n;
}
