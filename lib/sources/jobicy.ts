import { htmlToText } from "../text";
import type { RawJob } from "../types";
import { getJson, matchesAnyTerm, type Source } from "./types";

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
}

export function mapJobicy(job: JobicyJob): RawJob {
  const types = (job.jobType ?? []).map((t) => t.toLowerCase());
  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"} ${job.salaryCurrency ?? ""} ${job.salaryPeriod ?? ""}`.trim()
      : null;
  return {
    source: "jobicy",
    externalId: String(job.id),
    title: htmlToText(job.jobTitle),
    company: htmlToText(job.companyName),
    url: job.url,
    description: htmlToText(job.jobDescription ?? ""),
    region: "INTL",
    location: `Remote (${job.jobGeo ?? "unspecified"})`,
    lat: null,
    lon: null,
    remote: true,
    eligibleRegions: job.jobGeo ?? null,
    workingHours: types.includes("full-time") ? "full_time" : types.includes("part-time") ? "part_time" : null,
    contractType: types.includes("contract") || types.includes("freelance") ? "temporary" : null,
    salary,
    deadline: null,
    publishedAt: job.pubDate ?? null,
  };
}

/** Jobicy remote jobs, pre-filtered by the feed to roles open to people in Sweden. One request per run. */
export const jobicy: Source = {
  name: "jobicy",
  label: "Jobicy",
  enabled: (prefs) => prefs.includeInternationalRemote,
  async fetch({ prefs }) {
    const data = await getJson<{ jobs?: JobicyJob[] }>("https://jobicy.com/api/v2/remote-jobs?count=100&geo=sweden");
    return (data.jobs ?? [])
      .filter((j) => matchesAnyTerm(`${j.jobTitle} ${(j.jobIndustry ?? []).join(" ")}`, prefs.searchTerms))
      .map(mapJobicy);
  },
};
