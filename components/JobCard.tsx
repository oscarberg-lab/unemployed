import Link from "next/link";
import { changeStatus, giveFeedback } from "@/app/actions";
import { sourceLabel } from "@/lib/sources";
import type { JobRow } from "@/lib/types";

export const scoreClass = (score: number | null) =>
  score == null ? "score" : score >= 85 ? "score score-top" : score >= 70 ? "score score-good" : score >= 50 ? "score score-mid" : "score score-low";

export const jobHref = (id: string) => `/jobs/${encodeURIComponent(id)}`;

const day = (d: Date | null) => (d ? new Date(d).toLocaleDateString("sv-SE") : null);

export function JobMeta({ job }: { job: JobRow }) {
  const parts = [
    job.company,
    job.location,
    job.work_mode && job.work_mode !== "unknown" ? job.work_mode : null,
    job.salary,
    job.published_at ? `posted ${day(job.published_at)}` : null,
    job.deadline ? `apply by ${day(job.deadline)}` : null,
    `via ${sourceLabel(job.source)}`,
  ].filter(Boolean);
  return <p className="meta">{parts.join(" · ")}</p>;
}

export function JobCard({ job }: { job: JobRow }) {
  return (
    <article className="card job">
      <div className={scoreClass(job.score)} title="Overall fit, 0-100">{job.score ?? "–"}</div>
      <div className="job-body">
        <h3>
          <Link href={jobHref(job.id)}>{job.title}</Link>
          {job.status !== "new" && <span className="tag">{job.status}</span>}
        </h3>
        <JobMeta job={job} />
        {job.summary && <p>{job.summary}</p>}
        {job.gaps && job.gaps.length > 0 && (
          <p className="chips">
            <span className="chips-label">Gaps:</span>
            {job.gaps.map((g) => <span className="chip" key={g}>{g}</span>)}
          </p>
        )}
        <div className="row">
          <form action={giveFeedback} className="row">
            <input type="hidden" name="id" value={job.id} />
            <button className={job.feedback === "up" ? "btn btn-small btn-on" : "btn btn-small"} name="feedback" value="up" title="Interested: saves the job and teaches the scoring">
              Interested
            </button>
            <button className={job.feedback === "down" ? "btn btn-small btn-on" : "btn btn-small"} name="feedback" value="down" title="Not interested: hides the job and teaches the scoring">
              Not for me
            </button>
          </form>
          {job.status !== "applied" && (
            <form action={changeStatus}>
              <input type="hidden" name="id" value={job.id} />
              <button className="btn btn-small" name="status" value="applied">Mark applied</button>
            </form>
          )}
          <a className="btn btn-small" href={job.url} target="_blank" rel="noreferrer">Open posting</a>
        </div>
      </div>
    </article>
  );
}
