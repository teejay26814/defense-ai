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
    <div className="animate-fade rounded-2xl border border-navy-100 bg-white/70 p-6 shadow-base">
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
            className={`w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-ink shadow-base
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-muted">
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
                    className="rounded-full border border-navy-100 bg-white/70 px-3 py-1.5 text-left text-xs text-ink
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
          <div className="field-parchment surface-grain rounded-2xl border border-navy-100 p-6 shadow-elevated">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              Answer
            </p>
            <div className="mt-3 space-y-3 whitespace-pre-wrap leading-relaxed text-ink">
              {state.answer}
            </div>
          </div>

          {state.sources && state.sources.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg text-ink">
                From your project
              </h2>
              <ul className="stagger-children space-y-2">
                {state.sources.map((s, i) => (
                  <li
                    key={s.id}
                    className={`rounded-xl border p-4 text-sm shadow-base transition-[border-color] duration-150
                      ${s.cited ? "border-gold/40 bg-white/80" : "border-navy-100 bg-white/50"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-navy-050 px-1.5 py-0.5 text-xs font-medium text-navy-700">
                        [{i + 1}]
                      </span>
                      <span className="font-medium text-ink">
                        {s.chapter ? `Chapter ${s.chapter}` : "Section"}
                        {s.label ? ` - ${s.label}` : ""}
                      </span>
                      {s.cited && (
                        <span className="rounded bg-gold/15 px-1.5 py-0.5 text-xs font-medium text-warning">
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
