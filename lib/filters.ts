import { withinAnyPlace } from "./geo";
import { dedupeKey, normalize } from "./text";
import type { Preferences, RawJob } from "./types";

/** Regions in an international posting that include someone living in Sweden. */
const OPEN_TO_SWEDEN = /\b(worldwide|anywhere|global|europe|european union|eu|emea|sweden|nordics?|scandinavia)\b/i;

/**
 * Cheap rules applied before any model call. Returns a reason to drop the job, or null to keep it.
 * Anything fuzzy (industry, language, salary hidden in prose) is left to the scoring step.
 */
export function hardFilter(job: RawJob, prefs: Preferences): string | null {
  const company = normalize(job.company);
  if (prefs.avoidCompanies.some((c) => normalize(c) && company.includes(normalize(c)))) return "company excluded";

  if (job.workingHours && prefs.workingHours.length && !prefs.workingHours.includes(job.workingHours))
    return `working hours: ${job.workingHours}`;
  if (job.contractType && prefs.contractTypes.length && !prefs.contractTypes.includes(job.contractType))
    return `contract type: ${job.contractType}`;

  if (job.region === "INTL") {
    if (!prefs.includeInternationalRemote) return "international jobs disabled";
    if (!job.remote) return "international and not remote";
    if (!job.eligibleRegions || !OPEN_TO_SWEDEN.test(job.eligibleRegions)) return "not open to candidates in Sweden";
    return null;
  }

  if (prefs.places.length === 0) return null;
  if (job.remote && prefs.workModes.includes("remote")) return null;
  if (job.lat == null || job.lon == null) return null; // unknown location: let scoring judge
  if (!withinAnyPlace(job.lat, job.lon, prefs.places)) return "outside travel distance";
  return null;
}

/** Drop repeats of the same posting within one batch, keeping the first. */
export function dedupe(jobs: RawJob[]): RawJob[] {
  const ids = new Set<string>();
  const keys = new Set<string>();
  const out: RawJob[] = [];
  for (const job of jobs) {
    const id = `${job.source}:${job.externalId}`;
    const key = dedupeKey(job);
    if (ids.has(id) || keys.has(key)) continue;
    ids.add(id);
    keys.add(key);
    out.push(job);
  }
  return out;
}
