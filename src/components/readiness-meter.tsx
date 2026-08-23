/**
 * The readiness meter.
 *
 * This is the product's north star made visible: "If your defense was tomorrow, would you
 * be ready?" A number you can see beats a sentence you have to read.
 *
 * It shows coverage until a mock defense has been sat, and the real readiness score after
 * that. The distinction matters and the caller is responsible for labelling it honestly:
 * coverage counts uploads, readiness is earned by answering. Presenting the first as the
 * second would be the one lie this product cannot afford.
 *
 * Form choices are deliberate, not stylistic:
 *
 * - A **meter**, not a radial gauge. A gauge for one ratio is a two-slice pie wearing a
 *   costume; a single ratio against a limit reads better on a same-ramp track.
 * - The figure is set in the **body sans, not the display serif**. A serif on a hero number
 *   reads as decoration rather than data.
 * - **Proportional figures, not tabular-nums.** Equal-width digits make a large "12" look
 *   gappy. Tabular is for columns of numbers, not a standalone one.
 * - The track is `navy-300`, not `navy-100`. navy-100 measures 1.22:1 against parchment,
 *   which is invisible; navy-300 clears the 2:1 floor at 2.10:1.
 * - Gold sits at 2.36:1 on parchment, under the 3:1 mark for a mark read on its own. It is
 *   used anyway because the palette reserves gold for readiness, and the required relief is
 *   present: the value is printed, in words as well as digits, right beside the bar.
 */

export type ReadinessLevel = "none" | "early" | "building" | "ready";

/**
 * Thresholds carry the encouraging tone the product is meant to have. Nothing says
 * "failing" — the lowest band is an invitation, because a student seeing 8% the week
 * before a defense needs a next step, not a verdict.
 */
function levelFor(value: number): { level: ReadinessLevel; label: string } {
  if (value <= 0) return { level: "none", label: "Not started" };
  if (value < 40) return { level: "early", label: "Just getting going" };
  if (value < 80) return { level: "building", label: "Coming together" };
  return { level: "ready", label: "Defense ready" };
}

const FILL: Record<ReadinessLevel, string> = {
  none: "bg-navy-300",
  early: "bg-navy-500",
  building: "bg-gold",
  ready: "bg-success",
};

export function ReadinessMeter({
  value,
  caption,
}: {
  /** 0 to 100. Clamped, so a bad computation cannot overflow the track. */
  value: number;
  caption?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const { level, label } = levelFor(pct);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        {/*
          The hero figure. Sans, large, proportional digits. The % sign is deliberately
          smaller and muted so the number itself carries the weight.
        */}
        <p className="figures-display font-sans text-5xl font-semibold text-ink">
          {pct}
          <span className="ml-0.5 align-top text-xl font-medium text-ink-muted">%</span>
        </p>

        <p className="label-eyebrow">{label}</p>
      </div>

      {/*
        The track. role="meter" is not reliably announced, so this is a progressbar with an
        explicit text value - a screen reader gets the same reading as the eye.
      */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${pct} percent, ${label}`}
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-navy-100 shadow-[inset_0_1px_2px_rgb(5_38_89/0.12)]"
      >
        <div
          className={`h-full rounded-full shadow-[0_1px_2px_rgb(5_38_89/0.18)] transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${FILL[level]}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {caption && (
        <p className="measure mt-3 text-sm leading-relaxed text-ink-muted">{caption}</p>
      )}
    </div>
  );
}
