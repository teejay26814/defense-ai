import type { ComponentProps } from "react";

/**
 * Surfaces.
 *
 * The design guardrails call for a real layering system - base, elevated, floating - rather
 * than one flat plane. Those three map to the three shadow tokens, which are tinted with
 * the brand navy at low opacity rather than a neutral grey blur.
 *
 * `interactive` is separate from the elevation on purpose: a card that is clickable needs
 * hover and active states, but plenty of cards are just containers and should not respond
 * to the pointer at all.
 */

export type CardElevation = "base" | "elevated" | "floating";

const ELEVATION: Record<CardElevation, string> = {
  base: "shadow-raised",
  elevated: "shadow-lifted",
  floating: "shadow-overlay",
};

export function Card({
  elevation = "base",
  interactive = false,
  className,
  ...props
}: ComponentProps<"div"> & {
  elevation?: CardElevation;
  interactive?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-surface border border-navy-100/70 bg-surface p-6",
        ELEVATION[elevation],
        interactive
          ? "press hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-lifted"
          : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={`mb-3 space-y-1${className ? ` ${className}` : ""}`} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={`font-display text-xl leading-snug text-ink${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}

/** Secondary text inside a card - muted, never the same weight as the title. */
export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={`text-sm leading-relaxed text-ink-muted${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}
