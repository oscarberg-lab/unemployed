import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { changeStatus } from "@/app/actions";
import { jobHref, statusLabel } from "@/components/JobCard";
import { ScoreRing } from "@/components/ScoreRing";
import { trackedJobs } from "@/lib/store";
import { STATUSES, type Status } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLUMNS: { status: Status; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Closed" },
];

export default async function TrackerPage() {
  const jobs = await trackedJobs();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your applications</h1>
          <p className="lede">One place to keep track of where things stand, from first interest to final answer.</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty">
          <ClipboardList size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2>Nothing to track yet</h2>
          <p className="muted">When you mark a match as interesting or applied, it appears here so you can follow it through.</p>
          <Link className="btn" href="/">Look at your matches</Link>
        </div>
      ) : (
        <div className="board">
          {COLUMNS.map((col) => {
            const items = jobs.filter((j) => j.status === col.status);
            return (
              <section key={col.status} className="column" aria-label={col.label}>
                <div className="column-head">
                  <h2>{col.label}</h2>
                  <span className="small muted">{items.length}</span>
                </div>
                {items.length === 0 && <p className="column-empty">Nothing here.</p>}
                {items.map((job) => (
                  <article key={job.id} className="mini">
                    <div className="mini-top">
                      <div>
                        <Link href={jobHref(job.id)} className="mini-title">{job.title}</Link>
                        <p className="small muted">{job.company}</p>
                      </div>
                      <ScoreRing score={job.score} size={44} showLabel={false} />
                    </div>
                    {job.notes && <p className="small muted">{job.notes}</p>}
                    <form action={changeStatus} className="row">
                      <input type="hidden" name="id" value={job.id} />
                      <select name="status" defaultValue={job.status} aria-label={`Status for ${job.title}`}>
                        {STATUSES.filter((s) => s !== "new").map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                      <button className="btn btn-small">Move</button>
                    </form>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
