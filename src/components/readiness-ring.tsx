import type { CSSProperties } from "react";

import { ProgressBar } from "@/components/ui/progress-bar";

/**
 * The readiness ring.
 *
 * Replaces the horizontal meter on the dashboard. Same honesty rule as before and it is
 * worth restating here because a ring makes it easy to forget: this shows *coverage* -
 * chapters uploaded and indexed - until a real mock defense has been sat, and only shows
 * *readiness* after that. The caller passes the value already resolved and must not blur
 * the two into one number silently.
 *
 * An SVG circle with stroke-dasharray rather than a canvas or a library donut. It is one
 * shape, it needs no JS to animate (the transition is a CSS custom property), and it
 * degrades to a static ring if JS never runs at all.
 */

function ringColor(value: number): string {
  if (value <= 0) return "var(--color-navy-300)";
  if (value < 40) return "var(--color-navy-500)";
  if (value < 80) return "var(--color-navy-700)";
  return "var(--color-success)";
}

export function ReadinessRing({
  value,
  size = 168,
  strokeWidth = 14,
  label,
}: {
  /** 0 to 100. */
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  // Below this, "text-4xl" no longer fits inside the ring's own hole - it used to spill
  // past the stroke and over whatever sits next to it. A ring this small (the decorative
  // one on the dashboard's dark panel) is a glance-able indicator, not a place to read an
  // exact number, so it shows the shape only and carries the value in its aria-label instead.
  const showValue = size >= 80;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      {...(!showValue ? { role: "img", "aria-label": `${pct} percent, ${label}` } : {})}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-navy-100)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor(pct)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          // Fills from empty on first paint. The page is server-rendered at the final value,
          // so the transition above only ever ran when a score changed in place - the one
          // number the whole product is about just appeared, already drawn. @starting-style
          // gives it a from-state with no JS; browsers without it show the final ring.
          style={{ "--ring-empty": circumference } as CSSProperties}
          className="transition-[stroke-dashoffset] duration-700 ease-out-strong
            starting:[stroke-dashoffset:var(--ring-empty)] motion-reduce:transition-none"
        />
      </svg>

      {/*
        role="img" with a text alternative rather than aria-hidden + a separate visible
        number: the figure inside the ring IS the value, so it should be announced once,
        not twice. Below the showValue threshold the same role/label move to the outer div
        instead, since there is no visible text left to carry it.
      */}
      {showValue && (
        <div
          role="img"
          aria-label={`${pct} percent, ${label}`}
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="figures-display font-sans text-4xl font-semibold text-ink">{pct}%</span>
          <span className="label-eyebrow mt-1">{label}</span>
        </div>
      )}
    </div>
  );
}

/** One row of the breakdown beneath the ring: a label, a value, and a thin track. */
export function ReadinessSubmetric({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  /** Null renders a dash - for a metric that has no data yet, not a fabricated zero. */
  value: number | null;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="text-xs text-ink-muted">{hint}</p>
        </div>
        <span className="figures-data shrink-0 text-sm font-semibold text-ink">
          {value === null ? "–" : `${pct}%`}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar
          value={pct}
          label={label}
          trackClassName="bg-navy-100"
          fillClassName="bg-navy-500"
          durationClassName="duration-700"
        />
      </div>
    </div>
  );
}
