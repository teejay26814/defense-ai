/**
 * A thin progress bar.
 *
 * The fill is always full width and slides in from the left with `translateX`, rather than
 * having its `width` animated. Width is a layout property - animating it re-lays-out the bar
 * on every frame - and the design guardrails allow only transform and opacity. Sliding a
 * full-width fill also keeps its rounded leading edge, which `scaleX` would squash.
 *
 * The default colours are the theme-aware tokens. The bars this replaced used navy-700 on
 * navy-300, which are fixed brand swatches: in dark mode the navy fill all but vanished
 * against the canvas and the pale unfilled track read as the progress, backwards.
 */
export function ProgressBar({
  value,
  label,
  trackClassName = "bg-navy-100",
  fillClassName = "bg-brand",
  durationClassName = "duration-300",
}: {
  /** 0 to 100. Clamped. */
  value: number;
  /** What is being measured, for screen readers. */
  label: string;
  trackClassName?: string;
  fillClassName?: string;
  durationClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`h-1.5 w-full overflow-hidden rounded-full ${trackClassName}`}
    >
      <div
        className={`h-full w-full rounded-full transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] ${durationClassName} ${fillClassName}`}
        style={{ transform: `translateX(${pct - 100}%)` }}
      />
    </div>
  );
}
