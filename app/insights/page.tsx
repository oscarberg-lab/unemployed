import { Sprout } from "lucide-react";
import { gapCounts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const gaps = (await gapCounts()).slice(0, 25);
  const max = gaps[0]?.count ?? 1;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>What would open more doors</h1>
          <p className="lede">
            The requirements you most often lack in jobs that otherwise fit you. A few of these are probably worth learning, and some you
            may already have and simply need to make clearer in your CV.
          </p>
        </div>
      </div>

      {gaps.length === 0 ? (
        <div className="empty">
          <Sprout size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2>Nothing to show yet</h2>
          <p className="muted">Once a search has graded some jobs, the gaps that come up most often are gathered here.</p>
        </div>
      ) : (
        <section className="card">
          {gaps.map((g) => (
            <div key={g.gap} className="gap-row">
              <div className="bar-head">
                <strong>{g.gap}</strong>
                <span>{g.count} {g.count === 1 ? "job" : "jobs"}</span>
              </div>
              <div className="bar"><div style={{ width: `${(g.count / max) * 100}%` }} /></div>
              <p className="small muted">Asked for in: {g.examples.join(" · ")}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
