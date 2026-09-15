"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { finishDefense, submitAnswer, type DefenseState } from "../actions";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { getGenerationJobStatus } from "@/lib/generation-jobs";
import { DIFFICULTY_LABELS, type Question } from "@/lib/types";

// ssr:false rather than a plain import: this reads window.SpeechRecognition during its
// first render, and only ever loading it client-side means that render is always a real
// browser - no capability check needs to wait for an effect, and there is no server-vs-
// client markup to disagree about in the first place.
const DictateButton = dynamic(
  () => import("@/components/ui/dictate-button").then((m) => m.DictateButton),
  { ssr: false },
);

const initialState: DefenseState = {};

// How often to check on a running mark - see the questions GenerateForm for the same choice.
const POLL_INTERVAL_MS = 2500;

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
  const router = useRouter();

  // No local position. A successful mark comes back as a shorter queue from the server
  // (once router.refresh() below re-fetches it), and the next question is simply the head
  // of it. Tracking an index here would mean two sources of truth for where the student is,
  // and they would disagree the moment a mark failed or the page was reloaded mid-sitting.
  const current = queue[0];
  const done = !current;
  const position = alreadyAnswered;
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // Marking runs in a Netlify Background Function, not inside this request - the action
  // returns almost immediately once the job is started, so this polls the job row for the
  // result rather than the form's own pending state reflecting it.
  const [marking, setMarking] = useState<{ jobId: string; failed?: string } | null>(null);
  const markingJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.jobId && state.jobId !== markingJobIdRef.current) {
      markingJobIdRef.current = state.jobId;
      setMarking({ jobId: state.jobId });
    }
  }, [state.jobId]);

  useEffect(() => {
    if (!marking || marking.failed) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      const result = await getGenerationJobStatus(marking.jobId);
      if (cancelled || !result) return;

      if (result.status === "succeeded") {
        setMarking(null);
        router.refresh();
      } else if (result.status === "failed") {
        setMarking({
          jobId: marking.jobId,
          failed: result.error ?? "That answer could not be marked. Please try again.",
        });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [marking, router]);

  if (done) {
    return (
      <div className="animate-scale-in rounded-feature border border-navy-100/70 bg-surface p-8 text-center shadow-lifted">
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
        className="animate-scale-in rounded-feature border border-navy-100/70 bg-surface p-6 shadow-lifted sm:p-8"
      >
        {current.chapter && (
          <Badge tone="info" className="mb-3">
            Chapter {current.chapter}
          </Badge>
        )}

        <p className="font-display text-xl leading-snug text-ink sm:text-2xl">
          {current.question}
        </p>

        {(marking?.failed ?? state.error) && (
          <div className="mt-4">
            <FormMessage tone="error">{marking?.failed ?? state.error}</FormMessage>
          </div>
        )}

        <form action={formAction} className="mt-6" noValidate>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="questionId" value={current.id} />

          <fieldset disabled={marking !== null && !marking.failed}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <span className="text-xs text-ink-muted">
                Type, or dictate it the way you would say it in the room.
              </span>
              <DictateButton targetRef={answerRef} />
            </div>
            <textarea
              id="answer"
              ref={answerRef}
              name="answer"
              rows={7}
              autoFocus
              placeholder="Answer as you would say it out loud…"
              className="w-full resize-y rounded-lg border border-navy-100/70 bg-surface px-4 py-3 leading-relaxed text-ink shadow-raised
                transition-[border-color] duration-150
                placeholder:text-ink-muted/60
                hover:border-navy-300 focus-visible:border-navy-500"
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SubmitAnswer marking={marking !== null && !marking.failed} />
              <p className="text-xs text-ink-muted">
                You cannot come back to this one.
              </p>
            </div>
          </fieldset>

          {marking !== null && !marking.failed && (
            <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-muted">
              Your examiner is considering that…
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function SubmitAnswer({ marking }: { marking: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || marking;
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={buttonStyles()}>
      {busy ? "Marking…" : "Submit answer"}
    </button>
  );
}
