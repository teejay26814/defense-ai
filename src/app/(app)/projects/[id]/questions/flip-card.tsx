"use client";

import type { ReactNode } from "react";

/**
 * A real flip, not an accordion. The question and the answer are two faces of one card
 * rather than one block of text growing taller - clicking (or pressing space) turns the
 * card over, the way an actual flashcard would.
 *
 * `revealed` is owned by the caller rather than local state, because the same reveal also
 * has to happen from a keyboard shortcut in StudySession - there must be exactly one source
 * of truth for whether the card is turned over, never two.
 *
 * Only `transform` is animated, per the design guardrails, and the global
 * prefers-reduced-motion rule already zeroes every transition-duration to near-nothing, so
 * a reduced-motion visitor gets the same state change with no spin.
 */
export function FlipCard({
  revealed,
  onReveal,
  front,
  back,
}: {
  revealed: boolean;
  onReveal: () => void;
  front: ReactNode;
  back: ReactNode;
}) {
  return (
    <div className="[perspective:1600px]">
      <div
        className="relative min-h-[20rem] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] sm:min-h-[22rem]"
        style={{ transform: revealed ? "rotateY(180deg)" : "none" }}
      >
        <button
          type="button"
          onClick={onReveal}
          aria-hidden={revealed}
          tabIndex={revealed ? -1 : 0}
          className={`press absolute inset-0 flex w-full flex-col rounded-feature border border-navy-100/70
            bg-surface p-6 text-left shadow-lifted [backface-visibility:hidden] sm:p-8
            ${revealed ? "pointer-events-none" : ""}`}
        >
          {front}
        </button>

        {/*
          Pre-rotated 180deg so it lands right-side-up once the parent finishes its own
          turn - the same trick a real card trick relies on, just in CSS.
        */}
        <div
          aria-hidden={!revealed}
          className={`absolute inset-0 flex flex-col overflow-y-auto rounded-feature border border-navy-100/70
            bg-surface p-6 shadow-lifted [backface-visibility:hidden] sm:p-8
            ${revealed ? "" : "pointer-events-none"}`}
          style={{ transform: "rotateY(180deg)" }}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
