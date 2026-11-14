import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Switching tabs inside a project. Sits below the project layout, so the title and tabs
 * stay on screen and only the panel below them shows it is loading.
 */
export default function ProjectLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-fade space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="rounded-surface bg-surface p-6 shadow-raised sm:p-8">
        <Skeleton className="h-6 w-1/2 max-w-sm" />
        <div className="mt-6">
          <SkeletonText lines={4} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-surface bg-surface p-6 shadow-raised">
            <SkeletonText lines={3} />
          </div>
        ))}
      </div>
    </div>
  );
}
