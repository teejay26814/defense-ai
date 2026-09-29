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
 * Only `transform` is animated, per the design guardrails. 340ms, not longer: in a drill the
 * flip happens on every card, and at 500ms it started to feel like waiting for the answer
 * rather than turning it over.
 *
 * Under prefers-reduced-motion there is no spin at all - the card stays flat and the two
 * faces cross-fade instead. A 180-degree rotation is exactly the kind of large movement that
 * setting asks to avoid, but snapping instantly would lose the cue that the card changed.
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
        className={`relative min-h-[20rem] transition-transform duration-[340ms] ease-out-strong
          [transform-style:preserve-3d] motion-reduce:transform-none motion-reduce:transition-none
          sm:min-h-[22rem] ${revealed ? "[transform:rotateY(180deg)]" : ""}`}
      >
        <button
          type="button"
          onClick={onReveal}
          aria-hidden={revealed}
          tabIndex={revealed ? -1 : 0}
          className={`press absolute inset-0 flex w-full flex-col rounded-feature border border-navy-100/70
            bg-surface p-6 text-left shadow-lifted [backface-visibility:hidden] sm:p-8
            motion-reduce:transition-[opacity,transform] motion-reduce:duration-200
            ${revealed ? "pointer-events-none motion-reduce:opacity-0" : ""}`}
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
            bg-surface p-6 shadow-lifted [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-8
            motion-reduce:transform-none motion-reduce:transition-opacity motion-reduce:duration-200
            ${revealed ? "" : "pointer-events-none motion-reduce:opacity-0"}`}
        >
          {back}
        </div>
      </div>
    </div>
  );
}
