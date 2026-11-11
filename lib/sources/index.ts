import { jobicy } from "./jobicy";
import { jobtech } from "./jobtech";
import { remotive } from "./remotive";
import type { Source } from "./types";

/** Add a new job site by writing one adapter and listing it here. */
export const SOURCES: Source[] = [jobtech, jobicy, remotive];

export function sourceLabel(name: string): string {
  return SOURCES.find((s) => s.name === name)?.label ?? name;
}
