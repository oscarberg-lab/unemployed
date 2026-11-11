import { DEFAULT_PREFS, type Preferences, type Profile, type RawJob } from "@/lib/types";

export const STOCKHOLM = { name: "Stockholm", lat: 59.3293, lon: 18.0686, radiusKm: 30 };

export function job(over: Partial<RawJob> = {}): RawJob {
  return {
    source: "jobtech",
    externalId: "1",
    title: "Backend developer",
    company: "Acme AB",
    url: "https://example.com/1",
    description: "Build APIs.",
    region: "SE",
    location: "Stockholm, Stockholms län",
    lat: 59.33,
    lon: 18.06,
    remote: false,
    occupation: "Systemutvecklare",
    occupationField: "apaJ_2ja_LuF",
    eligibleRegions: null,
    workingHours: "full_time",
    contractType: "permanent",
    salary: null,
    deadline: null,
    publishedAt: "2026-11-10T08:00:00",
    ...over,
  };
}

export function prefs(over: Partial<Preferences> = {}): Preferences {
  return { ...DEFAULT_PREFS, places: [STOCKHOLM], searchTerms: ["backend developer"], ...over };
}

export const PROFILE: Profile = {
  name: "Test Person",
  headline: "Backend developer",
  seniority: "mid",
  yearsExperience: 4,
  skills: ["TypeScript", "PostgreSQL"],
  languages: [{ language: "Swedish", level: "native" }],
  education: [],
  experience: [],
  searchTerms: ["backend developer"],
  summary: "Builds APIs.",
};
