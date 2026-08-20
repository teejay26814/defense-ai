"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { finishDefense, submitAnswer, type DefenseState } from "../actions";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { DIFFICULTY_LABELS, type Question } from "@/lib/types";

const initialState: DefenseState = {};

/**
 * The sitting.
 *
 * One question at a time, and no way back. A defense does not let you revise an answer
 * after hearing what the panel thinks, so neither does this - the score would stop meaning
 * anything if it did.
 *
 * The mark is not shown between questions on purpose. Seeing 48% mid-sitting rattles a
 * nervous student and changes how they answer the rest, which is exactly the opposite of
 * rehearsing composure. Everything is shown together at the end.
 */

function Marking() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-muted">
      Your examiner is considering that…
    </p>
  );
}

export function Sitting({
  projectId,
  sessionId,
  queue,
  alreadyAnswered,
  total,
}: {
  projectId: string;
  sessionId: string;
  queue: Question[];
  alreadyAnswered: number;
  total: number;
}) {
  const [state, formAction] = useActionState(submitAnswer, initialState);
  const [finishState, finishAction] = useActionState(finishDefense, initialState);

  // No local position. The action revalidates this route, so a successful answer comes back
  // as a shorter queue from the server and the next question is simply the head of it.
  // Tracking an index here would mean two sources of truth for where the student is, and
  // they would disagree the moment a mark failed or the page was reloaded mid-sitting.
  const current = queue[0];
  const done = !current;
  const position = alreadyAnswered;

  if (done) {
    return (
      <div className="animate-scale-in rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-elevated">
        <h2 className="font-display text-2xl text-ink">That is the last question.</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
          Close the sitting to see your readiness, what you covered, and what your project
          says on the ones you were thin on.
        </p>

        {finishState.error && (
          <div className="mt-4">
            <FormMessage tone="error">{finishState.error}</FormMessage>
          </div>
        )}

        <form action={finishAction} className="mt-6">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="projectId" value={projectId} />
          <button type="submit" className={buttonStyles({ size: "lg" })}>
            See how I did
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          Question {position + 1} of {total}
        </p>
        <Badge tone="neutral">{DIFFICULTY_LABELS[current.difficulty] ?? "Explain"}</Badge>
      </div>

      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-navy-300">
        <div
          className="h-full rounded-full bg-navy-700 transition-[width] duration-300"
          style={{ width: `${(position / total) * 100}%` }}
        />
      </div>

      <div
        key={current.id}
        className="animate-scale-in rounded-2xl border border-navy-100 bg-white p-6 shadow-elevated sm:p-8"
      >
        {current.chapter && (
          <Badge tone="info" className="mb-3">
            Chapter {current.chapter}
          </Badge>
        )}

        <p className="font-display text-xl leading-snug text-ink sm:text-2xl">
          {current.question}
        </p>

        {state.error && (
          <div className="mt-4">
            <FormMessage tone="error">{state.error}</FormMessage>
          </div>
        )}

        <form action={formAction} className="mt-6" noValidate>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="questionId" value={current.id} />

          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="answer"
            name="answer"
            rows={7}
            autoFocus
            placeholder="Answer as you would say it out loud…"
            className="w-full resize-y rounded-lg border border-navy-100 bg-white px-4 py-3 leading-relaxed text-ink shadow-base
              transition-[border-color] duration-150
              placeholder:text-ink-muted/60
              hover:border-navy-300 focus-visible:border-navy-500"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SubmitAnswer />
            <p className="text-xs text-ink-muted">
              You cannot come back to this one.
            </p>
          </div>

          <Marking />
        </form>
      </div>
    </div>
  );
}

function SubmitAnswer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonStyles()}>
      {pending ? "Marking…" : "Submit answer"}
    </button>
  );
}
