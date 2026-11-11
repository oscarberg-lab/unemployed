import type { RawJob } from "../types";
import { getJson, type Source, type SourceQuery } from "./types";

/** Arbetsförmedlingen's open JobSearch API (Platsbanken). No key required. */
const BASE = "https://jobsearch.api.jobtechdev.se/search";
const PAGE = 100;
const MAX_PER_QUERY = 200;

export interface JobTechHit {
  id: string;
  headline: string;
  webpage_url: string | null;
  description?: { text?: string | null } | null;
  employer?: { name?: string | null; workplace?: string | null } | null;
  working_hours_type?: { label?: string | null } | null;
  duration?: { label?: string | null } | null;
  employment_type?: { label?: string | null } | null;
  occupation?: { label?: string | null } | null;
  occupation_field?: { concept_id?: string | null } | null;
  salary_description?: string | null;
  application_deadline?: string | null;
  publication_date?: string | null;
  workplace_address?: {
    municipality?: string | null;
    region?: string | null;
    city?: string | null;
    coordinates?: [number | null, number | null] | null;
  } | null;
}

export function mapJobTechHit(hit: JobTechHit, remote: boolean): RawJob {
  const addr = hit.workplace_address;
  // JobTech gives [longitude, latitude].
  const [lon, lat] = addr?.coordinates ?? [null, null];
  const hours = hit.working_hours_type?.label;
  const duration = hit.duration?.label;
  return {
    source: "jobtech",
    externalId: String(hit.id),
    title: hit.headline.trim(),
    company: hit.employer?.name ?? hit.employer?.workplace ?? "Unknown employer",
    url: hit.webpage_url ?? `https://arbetsformedlingen.se/platsbanken/annonser/${hit.id}`,
    description: hit.description?.text ?? "",
    region: "SE",
    location: [addr?.municipality ?? addr?.city, addr?.region].filter(Boolean).join(", ") || "Sweden",
    lat: lat ?? null,
    lon: lon ?? null,
    remote,
    occupation: hit.occupation?.label ?? null,
    occupationField: hit.occupation_field?.concept_id ?? null,
    eligibleRegions: null,
    workingHours: hours === "Heltid" ? "full_time" : hours === "Deltid" ? "part_time" : null,
    contractType: duration ? (duration === "Tills vidare" ? "permanent" : "temporary") : null,
    salary: hit.salary_description ?? null,
    deadline: hit.application_deadline ?? null,
    publishedAt: hit.publication_date ?? null,
  };
}

async function search(params: URLSearchParams, remote: boolean): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  for (let offset = 0; offset < MAX_PER_QUERY; offset += PAGE) {
    const url = new URL(BASE);
    url.search = params.toString();
    url.searchParams.set("limit", String(PAGE));
    url.searchParams.set("offset", String(offset));
    const page = await getJson<{ hits: JobTechHit[] }>(url);
    jobs.push(...page.hits.map((hit) => mapJobTechHit(hit, remote)));
    if (page.hits.length < PAGE) break;
  }
  return jobs;
}

export const jobtech: Source = {
  name: "jobtech",
  label: "Arbetsförmedlingen",
  enabled: () => true,
  async fetch({ prefs, fields, maxAgeDays }: SourceQuery) {
    const jobs: RawJob[] = [];
    for (const term of prefs.searchTerms) {
      const base = new URLSearchParams({ q: term, "published-after": String(maxAgeDays * 24 * 60) });
      // The free-text search matches across professions ("analytiker" finds lab analysts too),
      // so restrict it to the candidate's fields of work.
      for (const field of fields) base.append("occupation-field", field);

      // Jobs near the chosen places (or all of Sweden when none are chosen).
      const local = new URLSearchParams(base);
      for (const place of prefs.places) {
        local.append("position", `${place.lat},${place.lon}`);
        local.append("position.radius", String(Math.round(place.radiusKm)));
      }
      jobs.push(...(await search(local, false)));

      // Remote-flagged jobs anywhere in Sweden, if remote work is acceptable.
      if (prefs.places.length > 0 && prefs.workModes.includes("remote")) {
        const remote = new URLSearchParams(base);
        remote.set("remote", "true");
        jobs.push(...(await search(remote, true)));
      }
    }
    return jobs;
  },
};
