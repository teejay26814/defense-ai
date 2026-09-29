import type { ReactNode } from "react";

import { IconBook } from "@/components/icons";

/**
 * A passage quoted back from the student's own project - the model answer under a
 * flashcard, a quiz explanation, a mock-defense comparison.
 *
 * This used to be a tinted box with a thick coloured left border, repeated in four places.
 * That side-stripe callout is the most recognisable generated-UI habit there is, and it
 * said nothing about *what* the box was. Here the source is named by a small book mark
 * beside the label instead, so the panel reads as "cited from your chapters", which is the
 * product's whole promise, rather than as a generic alert.
 */
export function ProjectExcerpt({
  label = "From your project",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-surface bg-navy-050/70 px-4 py-3.5 shadow-hairline ${className}`}
    >
      <p className="label-eyebrow flex items-center gap-1.5">
        <IconBook className="size-3.5 text-navy-500" />
        {label}
      </p>
      {children}
    </div>
  );
}
