import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { changeStatus, giveFeedback } from "@/app/actions";
import { sourceLabel } from "@/lib/sources";
import type { JobRow } from "@/lib/types";
import { Reasons } from "./Reasons";
import { ScoreRing } from "./ScoreRing";

export const jobHref = (id: string) => `/jobs/${encodeURIComponent(id)}`;

const day = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Stockholm" }) : null;

const WORK_MODE: Record<string, string> = { onsite: "On site", hybrid: "Hybrid", remote: "Remote" };
const STATUS: Record<string, string> = { saved: "Saved", applied: "Applied", interview: "Interview", offer: "Offer", rejected: "Closed", dismissed: "Hidden" };
export const statusLabel = (status: string) => STATUS[status] ?? status;

/** Company, place and way of working: the facts people scan for first. */
export function jobFacts(job: JobRow): string {
  return [job.company, job.location, job.work_mode ? WORK_MODE[job.work_mode] : null, job.salary].filter(Boolean).join(" · ");
}

/** Dates and where the posting came from. Sources ask to be credited, so this is always shown. */
export function jobProvenance(job: JobRow): string {
  return [
    job.published_at ? `Posted ${day(job.published_at)}` : null,
    job.deadline ? `Apply by ${day(job.deadline)}` : null,
    `via ${sourceLabel(job.source)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function JobCard({ job }: { job: JobRow }) {
  return (
    <article className="job-card">
      <div className="job-main">
        <h2 className="job-title">
          <Link href={jobHref(job.id)}>{job.title}</Link>
          {job.status !== "new" && <span className="status-tag">{statusLabel(job.status)}</span>}
        </h2>
        <p className="job-meta">{jobFacts(job)}</p>
        {job.summary && <p>{job.summary}</p>}
        <Reasons strengths={job.strengths} gaps={job.gaps} />
        <div className="job-foot">
          <div className="job-actions">
            <form action={giveFeedback} className="job-actions">
              <input type="hidden" name="id" value={job.id} />
              <button className="btn btn-small" name="feedback" value="up" aria-pressed={job.feedback === "up"} title="Saves the job and teaches the grading what you like">
                Interested
              </button>
              <button className="btn btn-small btn-quiet" name="feedback" value="down" aria-pressed={job.feedback === "down"} title="Hides the job and teaches the grading what to avoid">
                Not for me
              </button>
            </form>
            {job.status !== "applied" && (
              <form action={changeStatus}>
                <input type="hidden" name="id" value={job.id} />
                <button className="btn btn-small btn-quiet" name="status" value="applied">I applied</button>
              </form>
            )}
            <Link className="btn btn-small btn-quiet" href={jobHref(job.id)}>Details</Link>
            <a className="btn btn-small btn-quiet" href={job.url} target="_blank" rel="noreferrer">
              Open posting <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
          <span className="small muted">{jobProvenance(job)}</span>
        </div>
      </div>
      <ScoreRing score={job.score} />
    </article>
  );
}
