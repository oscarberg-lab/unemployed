import Link from "next/link";
import { runNow } from "@/app/actions";
import { Flash, one, type Search } from "@/components/Flash";
import { JobCard } from "@/components/JobCard";
import { SubmitButton } from "@/components/SubmitButton";
import { effectiveFields } from "@/lib/fields";
import { getSettings, lastRun, listJobs, pendingCount, type JobView } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIEWS: { key: JobView; label: string }[] = [
  { key: "matches", label: "New" },
  { key: "all", label: "All" },
  { key: "dismissed", label: "Hidden" },
];

export default async function Home({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const view = (VIEWS.find((v) => v.key === one(params.view))?.key ?? "matches") as JobView;
  const minScore = Math.max(0, Math.min(100, Number(one(params.min) ?? 50) || 0));
  const { profile, prefs } = await getSettings();

  if (!profile) {
    return (
      <section className="card empty">
        <h1>Start with your CV</h1>
        <p>Upload your CV and choose where you want to work. The tool then searches once a day and grades each job against your profile.</p>
        <Link className="btn btn-primary" href="/profile">Upload CV</Link>
      </section>
    );
  }

  const [jobs, run, pending] = await Promise.all([listJobs(view, minScore), lastRun(), pendingCount()]);
  return (
    <>
      <div className="head">
        <div>
          <h1>Job matches</h1>
          <p className="meta">
            {run?.finished_at
              ? `Last search ${new Date(run.finished_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}${run.error ? " failed" : ""}`
              : "No search has run yet."}
            {pending > 0 && ` · ${pending} postings are waiting to be scored on the next run.`}
          </p>
        </div>
        <form action={runNow}>
          <SubmitButton className="btn btn-primary" pendingText="Searching and scoring… this can take a few minutes">Search now</SubmitButton>
        </form>
      </div>
      <Flash ok={one(params.ok)} error={one(params.error)} />
      {prefs.places.length === 0 && (
        <p className="flash">No places chosen, so jobs from all of Sweden are included. <Link href="/profile#places">Choose places</Link></p>
      )}
      {effectiveFields(profile, prefs).length === 0 && (
        <p className="flash">No fields of work chosen, so jobs from every profession are searched. <Link href="/profile#fields">Choose your fields</Link></p>
      )}
      <div className="tabs">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/?view=${v.key}&min=${minScore}`} className={v.key === view ? "tab tab-on" : "tab"}>{v.label}</Link>
        ))}
        <span className="spacer" />
        {[0, 50, 70, 85].map((m) => (
          <Link key={m} href={`/?view=${view}&min=${m}`} className={m === minScore ? "tab tab-on" : "tab"}>{m === 0 ? "Any score" : `${m}+`}</Link>
        ))}
      </div>
      {jobs.length === 0 ? (
        <p className="card empty">Nothing here yet. {run ? "Try a lower score filter, or wait for tomorrow's search." : "Press “Search now” to run the first search."}</p>
      ) : (
        jobs.map((job) => <JobCard key={job.id} job={job} />)
      )}
    </>
  );
}
