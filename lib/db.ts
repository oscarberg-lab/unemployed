import fs from "node:fs";
import path from "node:path";

/**
 * One tiny query interface over two drivers:
 *  - DATABASE_URL set  -> real Postgres (Neon, Supabase, ...)
 *  - otherwise         -> PGlite, an embedded Postgres stored in ./.data (zero setup)
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  profile JSONB,
  cv_filename TEXT,
  prefs JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  region TEXT NOT NULL,
  location TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  remote BOOLEAN NOT NULL DEFAULT false,
  eligible_regions TEXT,
  working_hours TEXT,
  contract_type TEXT,
  salary TEXT,
  deadline TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  dedupe_key TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  filtered_reason TEXT,
  score INT,
  subscores JSONB,
  summary TEXT,
  strengths JSONB,
  gaps JSONB,
  work_mode TEXT,
  scored_at TIMESTAMPTZ,
  score_attempts INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  feedback TEXT,
  feedback_note TEXT,
  feedback_at TIMESTAMPTZ,
  notes TEXT,
  cover_letter TEXT,
  notified BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS jobs_dedupe_key ON jobs (dedupe_key);
CREATE INDEX IF NOT EXISTS jobs_score ON jobs (score DESC);
CREATE TABLE IF NOT EXISTS runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  stats JSONB,
  error TEXT
);
`;

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    await pool.query(SCHEMA);
    return { query: async (text, params) => (await pool.query(text, params as unknown[])).rows };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pg");
  if (!dir.startsWith("memory://")) fs.mkdirSync(dir, { recursive: true });
  const lite = new PGlite(dir);
  await lite.exec(SCHEMA);
  return { query: async (text, params) => (await lite.query(text, params as unknown[])).rows as never[] };
}

// Survive Next.js dev hot reloads: PGlite allows only one open handle per directory.
const g = globalThis as unknown as { __db?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__db) g.__db = create();
  return g.__db;
}

/** Tests only. */
export function resetDbForTests() {
  g.__db = undefined;
}
