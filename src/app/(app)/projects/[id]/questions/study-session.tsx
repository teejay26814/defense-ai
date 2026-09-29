"use client";

import { useCallback, useEffect, useState } from "react";

import { recordConfidence } from "./actions";
import { FlipCard } from "./flip-card";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { CONFIDENCE_LABELS, DIFFICULTY_LABELS, type Question } from "@/lib/types";

/**
 * A drill, not a list.
 *
 * Scrolling a page of cards with the answers a keystroke away is reading, not recall. One
 * card at a time, answer hidden until asked for, and the rating only offered after it has
 * been seen.
 *
 * Moving forward does not require rating a card. The three rating buttons still advance
 * when pressed - that stays the natural path, and is what the readiness score is built
 * from - but a plain "Next" arrow sits beside them for a student who just wants to keep
 * moving, and a "Previous" arrow goes back to re-read a card already seen. Revealed state
 * is tracked per question, not as one shared flag, precisely so stepping back shows the
 * answer again immediately rather than making them reveal it a second time.
 *
 * Keyboard first: space reveals, the arrow keys step forward and back the same way the
 * on-screen arrows do, and 1/2/3 rates and advances. A student running through twenty
 * questions should never have to reach for the mouse, and that shortcut is most of what
 * makes this feel like a study tool rather than a web page.
 *
 * Anything rated shaky comes back at the end of the same session. Getting a card wrong and
 * never seeing it again is the one thing a drill must not do.
 */
export function StudySession({
  questions,
  projectId,
  onExit,
}: {
  questions: Question[];
  projectId: string;
  onExit: () => void;
}) {
  const [queue, setQueue] = useState<Question[]>(questions);
  const [position, setPosition] = useState(0);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [requeued, setRequeued] = useState<Question[]>([]);

  const current = queue[position];
  const done = position >= queue.length;
  const revealed = current ? revealedIds.has(current.id) : false;

  const reveal = useCallback(() => {
    if (!current) return;
    setRevealedIds((prev) => new Set(prev).add(current.id));
  }, [current]);

  const goNext = useCallback(() => {
    setPosition((p) => Math.min(p + 1, queue.length));
  }, [queue.length]);

  const goPrev = useCallback(() => {
    setPosition((p) => Math.max(p - 1, 0));
  }, []);

  const rate = useCallback(
    (level: number) => {
      if (!current || !revealed) return;

      setRatings((prev) => ({ ...prev, [current.id]: level }));

      // Persisted through the same server action the card list uses, so a session and a
      // scroll-through leave identical records.
      const data = new FormData();
      data.set("questionId", current.id);
      data.set("projectId", projectId);
      data.set("confidence", String(level));
      void recordConfidence(data);

      if (level === 1) setRequeued((prev) => [...prev, current]);

      goNext();
    },
    [current, revealed, projectId, goNext],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Never hijack typing in a field, and leave modified keys to the browser.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) reveal();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!revealed) reveal();
        else goNext();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (revealed && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        rate(Number(event.key));
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, reveal, goNext, goPrev, rate]);

  if (done) {
    const rated = Object.values(ratings);
    const shaky = rated.filter((r) => r === 1).length;
    const solid = rated.filter((r) => r === 3).length;

    return (
      <div className="animate-scale-in bloom rounded-feature border border-navy-100/70 bg-surface p-8 text-center shadow-lifted">
        <p className="font-sans text-4xl font-semibold leading-none text-ink">{rated.length}</p>
        <p className="mt-2 font-display text-xl text-ink">
          {rated.length === 1 ? "card reviewed" : "cards reviewed"}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
          {solid} solid · {shaky} shaky
          {shaky > 0 && ". The shaky ones are worth another pass before you stop."}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {requeued.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQueue(requeued);
                setRequeued([]);
                setPosition(0);
                // A fresh Set, not just cleared for these ids - a card being redone should
                // ask for real recall again, not show the answer immediately because it was
                // already opened once during the first pass.
                setRevealedIds(new Set());
              }}
              className={buttonStyles()}
            >
              Redo the {requeued.length} shaky {requeued.length === 1 ? "one" : "ones"}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className={buttonStyles({ variant: "secondary" })}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {position + 1} of {queue.length}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="rounded text-sm text-ink-muted underline-offset-4
            transition-colors duration-150 hover:text-brand hover:underline"
        >
          Browse all as a list
        </button>
      </div>

      <div className="mb-6">
        <ProgressBar value={(position / queue.length) * 100} label="Study session progress" />
      </div>

      <div key={current.id} className="animate-scale-in">
        <FlipCard
          revealed={revealed}
          onReveal={reveal}
          front={
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {current.chapter && <Badge tone="info">Chapter {current.chapter}</Badge>}
                <Badge tone="neutral">{DIFFICULTY_LABELS[current.difficulty] ?? "Explain"}</Badge>
              </div>

              <p className="font-display text-xl leading-snug text-ink sm:text-2xl">
                {current.question}
              </p>

              <div className="mt-auto pt-8">
                <p className="text-sm text-ink-muted">
                  Say your answer out loud first. That is what the room will ask of you.
                </p>
                <p className="mt-4 text-xs font-medium text-navy-500">
                  Tap the card to reveal · or press{" "}
                  <kbd className="rounded bg-navy-050 px-1.5 py-0.5 font-sans text-ink-muted">space</kbd>{" "}
                  or{" "}
                  <kbd className="rounded bg-navy-050 px-1.5 py-0.5 font-sans text-ink-muted">→</kbd>
                </p>
              </div>
            </>
          }
          back={
            <>
              <p className="label-eyebrow text-navy-500">From your project</p>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink">
                {current.model_answer}
              </p>
            </>
          }
        />

        {revealed && (
          <div className="animate-rise mt-6">
            <p className="mb-2 text-sm text-ink-muted">
              Could you have said that in front of a panel?
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => rate(level)}
                  className={buttonStyles({ variant: level === 3 ? "primary" : "secondary" })}
                >
                  <span className="mr-1.5 text-xs opacity-70">{level}</span>
                  {CONFIDENCE_LABELS[level]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              or press <kbd className="rounded bg-navy-050 px-1.5 py-0.5 font-sans">1</kbd>,{" "}
              <kbd className="rounded bg-navy-050 px-1.5 py-0.5 font-sans">2</kbd> or{" "}
              <kbd className="rounded bg-navy-050 px-1.5 py-0.5 font-sans">3</kbd>
            </p>
          </div>
        )}

        {/*
          Rating advances too, but not every card needs judging on the spot - this is the
          plain way through, for anyone who would rather just keep moving.
        */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={position === 0}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            <IconChevronLeft className="size-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!revealed}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            Next
            <IconChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
