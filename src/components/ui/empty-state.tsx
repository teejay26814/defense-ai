import type { ReactNode } from "react";

/**
 * The empty state.
 *
 * Every list in this product can legitimately be empty - no projects yet, no chapters
 * uploaded, no questions asked. The guardrail that matters here is the dashboard's: the
 * screen must always answer *what do I need to do next?* So an action is not optional
 * decoration, it is the point. An empty state with nothing to click is a dead end.
 *
 * The title is set in the display face like other headings, which keeps an empty screen
 * feeling composed rather than like an error.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  /** What to do about it. Give the student somewhere to go. */
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-surface border border-dashed border-navy-300/70 bg-navy-050/40 px-6 py-12 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-white text-navy-500 shadow-raised">
          {icon}
        </div>
      )}

      <h3 className="font-display text-lg text-ink">{title}</h3>

      <p className="mx-auto mt-1.5 max-w-prose text-sm leading-relaxed text-ink-muted">
        {description}
      </p>

      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
