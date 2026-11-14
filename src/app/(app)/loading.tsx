import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Shown the instant a student navigates between app screens, while the server fetches the
 * next one. Without it the old page just sat there until the new one arrived, which on a
 * slow connection reads as a tap that did not register.
 */
export default function AppLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-fade space-y-8">
      <span className="sr-only">Loading…</span>
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-surface bg-surface p-6 shadow-raised">
            <Skeleton className="h-4 w-1/3" />
            <div className="mt-5">
              <SkeletonText lines={3} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-surface bg-surface p-6 shadow-raised">
        <SkeletonText lines={5} />
      </div>
    </div>
  );
}
