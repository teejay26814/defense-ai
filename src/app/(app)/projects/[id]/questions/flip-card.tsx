"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
 *
 * Focus follows the flip. The front is a button, and revealing makes it inert - so without
 * this, a keyboard or screen-reader user who pressed it would be left focused on something
 * hidden, with the answer they asked for never announced. Focus moves only on the
 * turn-over itself, not when a card mounts already revealed (stepping back with Previous),
 * so it never jumps on its own.
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
  const backRef = useRef<HTMLDivElement>(null);
  const wasRevealed = useRef(revealed);

  useEffect(() => {
    if (revealed && !wasRevealed.current) backRef.current?.focus({ preventScroll: true });
    wasRevealed.current = revealed;
  }, [revealed]);

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
          ref={backRef}
          tabIndex={revealed ? -1 : undefined}
          aria-hidden={!revealed}
          className={`absolute inset-0 flex flex-col overflow-y-auto rounded-feature outline-none border border-navy-100/70
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
