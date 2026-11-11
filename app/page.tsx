import { Compass, Inbox } from "lucide-react";
import Link from "next/link";
import { runNow } from "@/app/actions";
import { Flash, one, type Search } from "@/components/Flash";
import { JobCard } from "@/components/JobCard";
import { JobListSkeleton } from "@/components/Skeleton";
import { SubmitButton } from "@/components/SubmitButton";
import { effectiveFields } from "@/lib/fields";
import { getSettings, lastRun, listJobs, pendingCount, type JobView } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VIEWS: { key: JobView; label: string }[] = [
  { key: "matches", label: "New" },
  { key: "all", label: "Everything" },
  { key: "dismissed", label: "Hidden" },
];
const SCORES = [
  { min: 75, label: "Great fits" },
  { min: 50, label: "Worth a look and up" },
  { min: 0, label: "All scores" },
];

export default async function Home({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const view = (VIEWS.find((v) => v.key === one(params.view))?.key ?? "matches") as JobView;
  const minScore = Math.max(0, Math.min(100, Number(one(params.min) ?? 50) || 0));
  const { profile, prefs } = await getSettings();

  if (!profile) {
    return (
      <section className="welcome">
        <p className="eyebrow">Welcome</p>
        <h1>Let’s see what fits you</h1>
        <p className="lede">
          Share your CV and tell us where you would like to work. Each morning we look through new job postings, set aside the ones that
          are not for you, and show you the rest with an honest score and the reasons behind it.
        </p>
        <Link className="btn btn-primary" href="/profile">Start with your CV</Link>
        <p className="small muted">It takes about three minutes. Your CV is only used to find and grade jobs for you.</p>
      </section>
    );
  }

  const [jobs, run, pending] = await Promise.all([listJobs(view, minScore), lastRun(), pendingCount()]);
  const lastSearch = run?.finished_at
    ? new Date(run.finished_at).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })
    : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your matches</h1>
          <p className="muted">
            {lastSearch ? `Last looked on ${lastSearch}${run?.error ? ", but that search did not finish" : ""}.` : "We have not searched yet."}
            {pending > 0 && ` ${pending} more ${pending === 1 ? "posting is" : "postings are"} waiting to be graded.`}
          </p>
        </div>
        <form action={runNow}>
          <SubmitButton search className="btn btn-primary" pendingText="Looking for jobs…">Search now</SubmitButton>
        </form>
      </div>

      <Flash ok={one(params.ok)} error={one(params.error)} />
      {prefs.places.length === 0 && (
        <p className="notice">
          <Compass size={18} aria-hidden="true" />
          <span>You have not chosen any places yet, so we are looking across all of Sweden. <Link href="/profile?step=2">Choose where you want to work</Link></span>
        </p>
      )}
      {effectiveFields(profile, prefs).length === 0 && (
        <p className="notice">
          <Compass size={18} aria-hidden="true" />
          <span>No fields of work are chosen, so jobs from every profession are included. <Link href="/profile?step=3#fields">Choose your fields</Link></span>
        </p>
      )}

      <div className="filters">
        <div className="filter-group" role="group" aria-label="Which jobs">
          {VIEWS.map((v) => (
            <Link key={v.key} href={`/?view=${v.key}&min=${minScore}`} className="filter" aria-current={v.key === view ? "true" : undefined}>{v.label}</Link>
          ))}
        </div>
        <div className="filter-group" role="group" aria-label="Minimum score">
          {SCORES.map((s) => (
            <Link key={s.min} href={`/?view=${view}&min=${s.min}`} className="filter" aria-current={s.min === minScore ? "true" : undefined}>{s.label}</Link>
          ))}
        </div>
      </div>

      <div className="searching" role="status">
        <p className="muted">Reading new postings and grading them against your profile. This usually takes a few minutes, and you can leave the page open.</p>
        <JobListSkeleton />
      </div>

      <div className="results">
        {jobs.length === 0 ? (
          <div className="empty">
            <Inbox size={28} strokeWidth={1.5} aria-hidden="true" />
            <h2>Nothing here right now</h2>
            <p className="muted">
              {run
                ? "No jobs match this view. Try including lower scores, or check back tomorrow: we look for new postings every morning."
                : "Press “Search now” and we will go and look. The first search takes a few minutes."}
            </p>
          </div>
        ) : (
          <div className="job-list">
            {jobs.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </div>
    </>
  );
}
