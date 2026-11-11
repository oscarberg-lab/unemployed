export type Seniority = "student" | "junior" | "mid" | "senior" | "lead" | "executive";
export type WorkMode = "onsite" | "hybrid" | "remote";

/** What Claude extracts from the CV. Seniority is derived, never asked. */
export interface Profile {
  name: string;
  headline: string;
  seniority: Seniority;
  yearsExperience: number;
  skills: string[];
  languages: { language: string; level: string }[];
  education: string[];
  experience: { title: string; company: string; period: string; summary: string }[];
  searchTerms: string[];
  summary: string;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
}

export interface Preferences {
  places: Place[];
  workModes: WorkMode[];
  includeInternationalRemote: boolean;
  minSalarySek: number | null;
  workingHours: ("full_time" | "part_time")[];
  contractTypes: ("permanent" | "temporary")[];
  avoidCompanies: string[];
  avoidIndustries: string[];
  searchTerms: string[];
  notes: string;
  digestMinScore: number;
}

export const DEFAULT_PREFS: Preferences = {
  places: [],
  workModes: ["onsite", "hybrid", "remote"],
  includeInternationalRemote: false,
  minSalarySek: null,
  workingHours: ["full_time"],
  contractTypes: ["permanent", "temporary"],
  avoidCompanies: [],
  avoidIndustries: [],
  searchTerms: [],
  notes: "",
  digestMinScore: 70,
};

/** A posting as returned by a source adapter, before filtering and scoring. */
export interface RawJob {
  source: string;
  externalId: string;
  title: string;
  company: string;
  url: string;
  description: string;
  /** "SE" for Swedish postings, "INTL" for international remote feeds. */
  region: "SE" | "INTL";
  location: string;
  lat: number | null;
  lon: number | null;
  /** The source itself flags the job as remote. */
  remote: boolean;
  /** Free text from international feeds, e.g. "Europe, USA". */
  eligibleRegions: string | null;
  workingHours: "full_time" | "part_time" | null;
  contractType: "permanent" | "temporary" | null;
  salary: string | null;
  deadline: string | null;
  publishedAt: string | null;
}

export interface Subscores {
  skills: number;
  seniority: number;
  location: number;
  preferences: number;
}

export interface JobScore {
  score: number;
  subscores: Subscores;
  summary: string;
  strengths: string[];
  gaps: string[];
  workMode: WorkMode | "unknown";
  /** For international postings: fully remote AND open to someone living in Sweden. */
  strictlyRemoteFromSweden: boolean;
}

export const STATUSES = ["new", "saved", "applied", "interview", "offer", "rejected", "dismissed"] as const;
export type Status = (typeof STATUSES)[number];

export interface JobRow {
  id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  description: string;
  region: "SE" | "INTL";
  location: string;
  remote: boolean;
  eligible_regions: string | null;
  working_hours: string | null;
  contract_type: string | null;
  salary: string | null;
  deadline: Date | null;
  published_at: Date | null;
  first_seen: Date;
  filtered_reason: string | null;
  score: number | null;
  subscores: Subscores | null;
  summary: string | null;
  strengths: string[] | null;
  gaps: string[] | null;
  work_mode: string | null;
  status: Status;
  feedback: "up" | "down" | null;
  feedback_note: string | null;
  notes: string | null;
  cover_letter: string | null;
  notified: boolean;
}

export interface FeedbackExample {
  title: string;
  company: string;
  feedback: "up" | "down";
  note: string | null;
}
