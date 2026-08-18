/**
 * Loading placeholders.
 *
 * `animate-pulse` animates opacity only, which is what the design guardrails allow - no
 * layout-affecting properties, and it stops entirely under prefers-reduced-motion because
 * globals.css collapses animation durations there.
 *
 * These exist mainly for the Ask page. Answers take eight to ten seconds and cannot stream
 * (generation runs in an n8n webhook, which responds all at once), so the wait has to be
 * furnished rather than left blank - otherwise the student cannot tell a slow answer from
 * a broken one.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-md bg-navy-100/70 ${className}`}
    />
  );
}

/** A block of fake text lines. The last line is short, the way real paragraphs end. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={`h-3.5 ${i === lines - 1 ? "w-2/5" : i % 3 === 1 ? "w-11/12" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/**
 * The Ask page's waiting state.
 *
 * `role="status"` with a live region so a screen reader announces that work is happening;
 * the visual skeleton is hidden from it, since reading out placeholder shapes is noise.
 */
export function AnswerSkeleton({
  message = "Reading your chapters…",
}: {
  message?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="text-sm text-ink-muted">{message}</p>
      <SkeletonText lines={5} />
    </div>
  );
}
