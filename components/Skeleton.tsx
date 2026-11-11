/** Placeholder shaped like a job card, shown while matches load or a search runs. */
export function JobCardSkeleton() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div>
        <div className="bone bone-title" />
        <div className="bone bone-line" />
        <div className="bone bone-text" />
        <div className="bone-pills">
          <div className="bone bone-pill" />
          <div className="bone bone-pill" />
          <div className="bone bone-pill" />
        </div>
      </div>
      <div className="bone bone-ring" />
    </div>
  );
}

export function JobListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="job-list">
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}
