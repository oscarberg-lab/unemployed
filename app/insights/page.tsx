import { gapCounts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const gaps = (await gapCounts()).slice(0, 25);
  const max = gaps[0]?.count ?? 1;
  return (
    <>
      <h1>Skill gaps</h1>
      <p className="meta">Requirements you are missing in jobs that otherwise fit (score 50 or higher), most frequent first. These are the things most worth learning or making clearer in your CV.</p>
      {gaps.length === 0 ? (
        <p className="card empty">No data yet. Gaps appear after the first search has scored some jobs.</p>
      ) : (
        <section className="card">
          {gaps.map((g) => (
            <div key={g.gap} className="gap">
              <div className="gap-head">
                <strong>{g.gap}</strong>
                <span className="meta">{g.count} job{g.count === 1 ? "" : "s"}</span>
              </div>
              <div className="bar"><div style={{ width: `${(g.count / max) * 100}%` }} /></div>
              <p className="meta">e.g. {g.examples.join(" · ")}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
