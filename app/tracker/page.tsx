import Link from "next/link";
import { changeStatus } from "@/app/actions";
import { jobHref, scoreClass } from "@/components/JobCard";
import { trackedJobs } from "@/lib/store";
import { STATUSES, type Status } from "@/lib/types";

export const dynamic = "force-dynamic";

const COLUMNS: { status: Status; label: string }[] = [
  { status: "saved", label: "Saved" },
  { status: "applied", label: "Applied" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "rejected", label: "Rejected" },
];

export default async function TrackerPage() {
  const jobs = await trackedJobs();
  return (
    <>
      <h1>Application tracker</h1>
      {jobs.length === 0 && <p className="card empty">Jobs you mark as interesting or applied show up here.</p>}
      <div className="board">
        {COLUMNS.map((col) => {
          const items = jobs.filter((j) => j.status === col.status);
          return (
            <section key={col.status} className="column">
              <h2>{col.label} <span className="meta">{items.length}</span></h2>
              {items.map((job) => (
                <article key={job.id} className="card mini">
                  <div className="row">
                    <span className={scoreClass(job.score)}>{job.score ?? "–"}</span>
                    <div>
                      <Link href={jobHref(job.id)}>{job.title}</Link>
                      <p className="meta">{job.company}</p>
                    </div>
                  </div>
                  {job.notes && <p className="meta">{job.notes}</p>}
                  <form action={changeStatus} className="row">
                    <input type="hidden" name="id" value={job.id} />
                    <select name="status" defaultValue={job.status} aria-label="Status">
                      {STATUSES.filter((s) => s !== "new").map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-small">Move</button>
                  </form>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
