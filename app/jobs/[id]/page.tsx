import { ArrowLeft, ArrowUpRight, ChevronDown, EyeOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { changeStatus, giveFeedback, saveNotes, writeCoverLetter } from "@/app/actions";
import { Flash, one, type Search } from "@/components/Flash";
import { jobFacts, jobProvenance, statusLabel } from "@/components/JobCard";
import { Reasons } from "@/components/Reasons";
import { ScoreRing, scoreTone } from "@/components/ScoreRing";
import { SubmitButton } from "@/components/SubmitButton";
import { getJob } from "@/lib/store";
import { STATUSES } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUBSCORES = [
  ["skills", "Skills"],
  ["seniority", "Level"],
  ["location", "Location"],
  ["preferences", "Your preferences"],
] as const;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const query = await searchParams;
  const job = await getJob(decodeURIComponent(id));
  if (!job) notFound();

  return (
    <>
      <Link href="/" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All matches</Link>
      <div className="detail-head">
        <div>
          <h1>{job.title}</h1>
          <p className="lede">{jobFacts(job)}</p>
          <p className="small muted">{jobProvenance(job)}</p>
          <div>
            <a className="btn btn-primary" href={job.url} target="_blank" rel="noreferrer">Open the posting <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
        <ScoreRing score={job.score} size={128} />
      </div>
      <Flash ok={one(query.ok)} error={one(query.error)} />

      {job.filtered_reason && (
        <p className="notice">
          <EyeOff size={18} aria-hidden="true" />
          <span>This job is kept out of your matches: {job.filtered_reason}.</span>
        </p>
      )}

      {job.subscores && (
        <section className="card stack-lg">
          <div className="stack">
            <h2>Why this score</h2>
            <p>{job.summary}</p>
          </div>
          <Reasons strengths={job.strengths} gaps={job.gaps} />
          <div className="bars">
            {SUBSCORES.map(([key, label]) => (
              <div key={key} className={`tone-${scoreTone(job.subscores![key]).tone}`}>
                <div className="bar-head"><strong>{label}</strong><span>{job.subscores![key]}%</span></div>
                <div className="bar"><div style={{ width: `${job.subscores![key]}%` }} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card stack-lg">
        <h2>Keep track</h2>
        <form action={changeStatus} className="row" style={{ alignItems: "flex-end" }}>
          <input type="hidden" name="id" value={job.id} />
          <div className="field">
            <label htmlFor="status">Where this stands</label>
            <select id="status" name="status" defaultValue={job.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{s === "new" ? "New" : statusLabel(s)}</option>)}
            </select>
          </div>
          <button className="btn">Update</button>
        </form>

        <form action={giveFeedback} className="stack">
          <input type="hidden" name="id" value={job.id} />
          <div className="field" style={{ width: "100%" }}>
            <label htmlFor="note">Is this the kind of job you want?</label>
            <input id="note" type="text" name="note" defaultValue={job.feedback_note ?? ""} placeholder="Optional: say why, e.g. too much travel, or exactly the kind of team I want" />
            <p className="hint">Your answer shapes how future jobs are scored.</p>
          </div>
          <div className="row">
            <button className="btn btn-small" name="feedback" value="up" aria-pressed={job.feedback === "up"}>Interested</button>
            <button className="btn btn-small" name="feedback" value="down" aria-pressed={job.feedback === "down"}>Not for me</button>
          </div>
        </form>

        <form action={saveNotes} className="stack">
          <input type="hidden" name="id" value={job.id} />
          <div className="field" style={{ width: "100%" }}>
            <label htmlFor="notes">Your notes</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={job.notes ?? ""} placeholder="Contact person, interview dates, things to follow up…" />
          </div>
          <SubmitButton className="btn btn-small" pendingText="Saving…">Save notes</SubmitButton>
        </form>
      </section>

      <section className="card stack-lg" id="letter">
        <div className="stack">
          <h2>Cover letter</h2>
          <p className="muted">A first draft written from your CV for this particular job. Treat it as a starting point and make it yours before sending.</p>
        </div>
        <form action={writeCoverLetter} className="stack">
          <input type="hidden" name="id" value={job.id} />
          <div className="field" style={{ width: "100%" }}>
            <label htmlFor="extra">Anything you want it to bring out?</label>
            <input id="extra" type="text" name="extra" placeholder="Optional, e.g. my thesis project, or that I can start in January" />
          </div>
          <SubmitButton pendingText="Writing your draft…">{job.cover_letter ? "Write a new draft" : "Draft a letter"}</SubmitButton>
        </form>
        {job.cover_letter && <pre className="letter">{job.cover_letter}</pre>}
      </section>

      <details className="card posting">
        <summary>Read the full posting <ChevronDown size={22} aria-hidden="true" /></summary>
        <div className="posting-text">{job.description}</div>
      </details>
    </>
  );
}
