import type { ComponentProps } from "react";

/**
 * Status pills.
 *
 * Tones are tied to meaning rather than to colour names, so a caller asks for "ready" or
 * "needs work" rather than picking green or amber. That keeps status consistent across the
 * dashboard, the document list and, later, the readiness score.
 *
 * Backgrounds are the semantic colour at low alpha with the full-strength colour as text -
 * which keeps contrast comfortable on parchment without introducing another set of tokens.
 */

export type BadgeTone = "neutral" | "info" | "ready" | "pending" | "attention" | "failed";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-navy-050 text-ink-muted ring-navy-100",
  info: "bg-navy-100/60 text-brand ring-navy-300/50",
  ready: "bg-success/10 text-success ring-success/20",
  pending: "bg-navy-500/10 text-navy-500 ring-navy-500/25",
  attention: "bg-warning/10 text-warning ring-warning/20",
  failed: "bg-danger/8 text-danger ring-danger/20",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
