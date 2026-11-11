import type { Preferences, RawJob } from "../types";

export interface SourceQuery {
  prefs: Preferences;
  /** Only postings published within this many days. */
  maxAgeDays: number;
}

export interface Source {
  name: string;
  /** Shown next to each job, some feeds require attribution. */
  label: string;
  enabled(prefs: Preferences): boolean;
  fetch(query: SourceQuery): Promise<RawJob[]>;
}

export async function getJson<T>(url: URL | string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "personal-job-search-tool" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  return (await res.json()) as T;
}

/** Cheap relevance gate for feeds that cannot be searched server-side. */
export function matchesAnyTerm(haystack: string, terms: string[]): boolean {
  const text = haystack.toLowerCase();
  return terms.some((term) => {
    const words = term.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    return words.length > 0 && words.every((w) => text.includes(w));
  });
}
