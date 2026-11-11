import { htmlToText } from "../text";
import type { RawJob } from "../types";
import { getJson, matchesAnyTerm, type Source } from "./types";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

export function mapRemotive(job: RemotiveJob): RawJob {
  return {
    source: "remotive",
    externalId: String(job.id),
    title: job.title.trim(),
    company: job.company_name.trim(),
    url: job.url,
    description: htmlToText(job.description ?? ""),
    region: "INTL",
    location: `Remote (${job.candidate_required_location || "unspecified"})`,
    lat: null,
    lon: null,
    remote: true,
    eligibleRegions: job.candidate_required_location || null,
    workingHours: job.job_type === "full_time" ? "full_time" : job.job_type === "part_time" ? "part_time" : null,
    contractType: job.job_type === "contract" || job.job_type === "freelance" ? "temporary" : null,
    salary: job.salary || null,
    deadline: null,
    publishedAt: job.publication_date ?? null,
  };
}

/** Remotive's public feed. Their terms ask for at most a few requests a day and a link back: one request per run. */
export const remotive: Source = {
  name: "remotive",
  label: "Remotive",
  enabled: (prefs) => prefs.includeInternationalRemote,
  async fetch({ prefs }) {
    const data = await getJson<{ jobs?: RemotiveJob[] }>("https://remotive.com/api/remote-jobs");
    return (data.jobs ?? [])
      .filter((j) => matchesAnyTerm(`${j.title} ${j.category ?? ""} ${(j.tags ?? []).join(" ")}`, prefs.searchTerms))
      .map(mapRemotive);
  },
};
