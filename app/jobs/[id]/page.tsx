import { notFound } from "next/navigation";
import { changeStatus, giveFeedback, saveNotes, writeCoverLetter } from "@/app/actions";
import { Flash, one, type Search } from "@/components/Flash";
import { JobMeta, scoreClass } from "@/components/JobCard";
import { SubmitButton } from "@/components/SubmitButton";
import { getJob } from "@/lib/store";
import { STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUBSCORES = [
  ["skills", "Skills"],
  ["seniority", "Seniority"],
  ["location", "Location"],
  ["preferences", "Preferences"],
] as const;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const query = await searchParams;
  const job = await getJob(decodeURIComponent(id));
  if (!job) notFound();

  return (
    <>
      <div className="head">
        <div className="row">
          <div className={scoreClass(job.score)}>{job.score ?? "–"}</div>
          <div>
            <h1>{job.title}</h1>
            <JobMeta job={job} />
          </div>
        </div>
        <a className="btn btn-primary" href={job.url} target="_blank" rel="noreferrer">Open posting</a>
      </div>
      <Flash ok={one(query.ok)} error={one(query.error)} />

      {job.filtered_reason && <p className="flash">Hidden from your matches: {job.filtered_reason}.</p>}

      {job.subscores && (
        <section className="card">
          <h2>Why this score</h2>
          <p>{job.summary}</p>
          <div className="subscores">
            {SUBSCORES.map(([key, label]) => (
              <div key={key}>
                <div className="gap-head"><span>{label}</span><span className="meta">{job.subscores![key]}</span></div>
                <div className="bar"><div style={{ width: `${job.subscores![key]}%` }} /></div>
              </div>
            ))}
          </div>
          {job.strengths && job.strengths.length > 0 && (
            <>
              <h3>What fits</h3>
              <ul>{job.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
          {job.gaps && job.gaps.length > 0 && (
            <p className="chips"><span className="chips-label">Gaps:</span>{job.gaps.map((g) => <span className="chip" key={g}>{g}</span>)}</p>
          )}
        </section>
      )}

      <section className="card">
        <h2>Track</h2>
        <div className="row">
          <form action={changeStatus} className="row">
            <input type="hidden" name="id" value={job.id} />
            <select name="status" defaultValue={job.status} aria-label="Status">
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-small">Set status</button>
          </form>
        </div>
        <form action={giveFeedback} className="stack">
          <input type="hidden" name="id" value={job.id} />
          <label>
            Feedback for the grading (optional reason)
            <input type="text" name="note" defaultValue={job.feedback_note ?? ""} placeholder="e.g. too much travel, or exactly the kind of team I want" />
          </label>
          <div className="row">
            <button className={job.feedback === "up" ? "btn btn-small btn-on" : "btn btn-small"} name="feedback" value="up">Interested</button>
            <button className={job.feedback === "down" ? "btn btn-small btn-on" : "btn btn-small"} name="feedback" value="down">Not for me</button>
          </div>
        </form>
        <form action={saveNotes} className="stack">
          <input type="hidden" name="id" value={job.id} />
          <label>
            Your notes
            <textarea name="notes" rows={3} defaultValue={job.notes ?? ""} placeholder="Contact person, interview dates, follow-ups…" />
          </label>
          <SubmitButton className="btn btn-small" pendingText="Saving…">Save notes</SubmitButton>
        </form>
      </section>

      <section className="card" id="letter">
        <h2>Cover letter</h2>
        <form action={writeCoverLetter} className="stack">
          <input type="hidden" name="id" value={job.id} />
          <label>
            Anything to emphasise (optional)
            <input type="text" name="extra" placeholder="e.g. my thesis project, that I can start in January" />
          </label>
          <SubmitButton pendingText="Writing…">{job.cover_letter ? "Rewrite letter" : "Write a tailored letter"}</SubmitButton>
        </form>
        {job.cover_letter && <pre className="letter">{job.cover_letter}</pre>}
        <p className="meta">A draft based only on your CV. Read and edit it before sending.</p>
      </section>

      <section className="card">
        <h2>Posting</h2>
        <div className="description">{job.description}</div>
      </section>
    </>
  );
}
