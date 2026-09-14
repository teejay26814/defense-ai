"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { askProject, type AskState } from "./actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { AnswerSkeleton } from "@/components/ui/skeleton";

const initialState: AskState = {};

/**
 * Suggestions, not decoration. A blank box invites "summarise my project", which is the
 * one question retrieval answers worst. These prompt the kind of specific, defensible
 * question a panel actually asks.
 */
const EXAMPLES = [
  "Why did I choose this methodology over the alternatives?",
  "What are the limitations of my study?",
  "How does my work differ from the literature I reviewed?",
  "What is my main contribution?",
];

/**
 * The waiting state.
 *
 * Answers take eight to ten seconds and cannot stream, because generation runs behind an
 * n8n webhook that responds all at once. So the wait has to be furnished: without this the
 * student stares at an unchanged page and cannot tell a slow answer from a broken one.
 *
 * It lives in its own component because useFormStatus only reports the status of the form
 * above it in the tree, so it has to sit inside that form rather than beside it.
 */
function Pending() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="animate-fade rounded-feature border border-navy-100/70 bg-surface/70 p-6 shadow-raised">
      <AnswerSkeleton message="Reading your chapters…" />
    </div>
  );
}

export function AskForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(askProject, initialState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="projectId" value={projectId} />

        <div className="space-y-1.5">
          <label htmlFor="question" className="block text-sm font-medium text-ink">
            Ask anything about your project
          </label>
          <textarea
            id="question"
            name="question"
            rows={3}
            required
            defaultValue={state.question}
            placeholder="What would your panel ask you about this?"
            aria-invalid={Boolean(state.fieldErrors?.question) || undefined}
            className={`w-full resize-y rounded-control border bg-surface px-3.5 py-2.5 text-ink shadow-raised
              transition-[border-color,box-shadow] duration-150
              placeholder:text-ink-muted/60
              hover:border-navy-300 focus-visible:border-navy-500
              ${state.fieldErrors?.question ? "border-danger" : "border-navy-100"}`}
          />
          {state.fieldErrors?.question && (
            <p className="text-xs font-medium text-danger">
              {state.fieldErrors.question.join(" ")}
            </p>
          )}
        </div>

        <SubmitButton pendingLabel="Asking your project…">Ask my project</SubmitButton>

        <Pending />
      </form>

      {!state.answer && !state.error && (
        <div>
          <p className="label-eyebrow mb-2">
            Try one of these
          </p>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((q) => (
              <li key={q}>
                {/* Fills the textarea rather than submitting - the student can edit first. */}
                <form action={formAction} className="contents">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="question" value={q} />
                  <button
                    type="submit"
                    className="rounded-full border border-navy-100/70 bg-surface/70 px-3 py-1.5 text-left text-xs text-ink
                      transition-[background-color,border-color,transform] duration-150
                      hover:border-navy-300 hover:bg-navy-050
                      active:translate-y-px"
                  >
                    {q}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      {state.answer && (
        <article className="animate-rise space-y-5">
          {/*
            The answer is set as prose, not boxed. It is the longest text on the screen and
            the reason the student is here; enclosing it in a card makes it look like a
            widget's output rather than something written for them.
          */}
          <div>
            <p className="label-eyebrow text-navy-500">Answer</p>
            <div className="measure mt-4 whitespace-pre-wrap font-display text-lg leading-[1.7] text-ink">
              {state.answer}
            </div>
          </div>

          {state.sources && state.sources.length > 0 && (
            <section>
              <h2 className="label-eyebrow mb-1 border-t border-navy-100 pt-5">
                From your project
              </h2>
              <ul className="stagger-children">
                {state.sources.map((s, i) => (
                  <li
                    key={s.id}
                    className={`rule-hairline py-4 text-sm transition-opacity duration-200
                      ${s.cited ? "" : "opacity-55"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="figures-data rounded bg-navy-050 px-1.5 py-0.5 text-2xs font-semibold text-brand">
                        [{i + 1}]
                      </span>
                      <span className="font-medium text-ink">
                        {s.chapter ? `Chapter ${s.chapter}` : "Section"}
                        {s.label ? ` - ${s.label}` : ""}
                      </span>
                      {s.cited && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                          cited
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-ink-muted">{s.excerpt}…</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
