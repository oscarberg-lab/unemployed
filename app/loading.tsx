import { JobListSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="bone bone-h1" />
      <JobListSkeleton />
    </div>
  );
}
