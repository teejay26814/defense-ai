import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Sitting } from "./sitting";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  DEFENSE_SCOPES,
  DEFENSE_SITTING_LENGTH,
  readinessBand,
  type DefenseAnswer,
  type DefenseSession,
  type Question,
} from "@/lib/types";

export const metadata: Metadata = { title: "Mock defense" };

/**
 * One sitting: either in progress, or its result.
 *
 * A finished sitting shows every answer beside what the project said, because that
 * comparison is the whole value. A score on its own tells a student they are at 64 and
 * nothing about what to do with that.
 */
export default async function SittingPage({
  params,
}: PageProps<"/projects/[id]/defense/[sessionId]">) {
  const { id, sessionId } = await params;
  const supabase = await createClient();

  const { data: sessionRow } = await supabase
    .from("defense_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (!sessionRow) notFound();
  const session = sessionRow as DefenseSession;

  const { data: answerRows } = await supabase
    .from("defense_answers")
    .select("*")
    .eq("session_id", sessionId)
    .order("answered_at", { ascending: true });

  const answers = (answerRows ?? []) as DefenseAnswer[];

  // ---- finished ----------------------------------------------------------
  if (session.status === "complete" && session.readiness !== null) {
    const band = readinessBand(session.readiness);
    const weakest = [...answers].sort((a, b) => a.score - b.score).slice(0, 3);

    return (
      <div className="space-y-8">
        <div className="animate-scale-in bloom rounded-feature border border-navy-100/70 bg-surface p-8 text-center shadow-lifted">
          <p className="label-eyebrow text-navy-500">
            Readiness
          </p>
          <p className="mt-3 font-sans text-6xl font-semibold leading-none tracking-tight text-ink">
            {session.readiness}
            <span className="ml-0.5 text-2xl font-medium text-ink-muted">%</span>
          </p>
          <p className="mt-3 font-display text-2xl text-ink">{band.label}</p>
          <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
            {band.note}
          </p>
          <p className="mx-auto mt-4 max-w-prose text-xs text-ink-muted">
            Weighted by difficulty, so defending a choice counts for more than recalling a
            fact. Based on {answers.length} answer{answers.length === 1 ? "" : "s"}.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/projects/${id}/defense`} className={buttonStyles()}>
              Sit another
            </Link>
            <Link
              href={`/projects/${id}/questions`}
              className={buttonStyles({ variant: "secondary" })}
            >
              Back to practice
            </Link>
          </div>
        </div>

        {weakest.length > 0 && weakest[0].score < 85 && (
          <section>
            <h3 className="mb-3 font-display text-xl text-ink">Worth another look</h3>
            <ul className="stagger-children space-y-3">
              {weakest
                .filter((a) => a.score < 85)
                .map((a) => (
                  <li
                    key={a.id}
                    className="rounded-surface border border-navy-100/70 bg-surface p-5 shadow-raised"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={a.score >= 70 ? "pending" : "attention"}>
                        {a.score}%
                      </Badge>
                    </div>
                    <p className="font-display text-base leading-snug text-ink">
                      {a.question}
                    </p>
                    {a.missed.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {a.missed.map((m, i) => (
                          <li key={i} className="flex gap-2 text-sm text-ink-muted">
                            <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-navy-500" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-3 font-display text-xl text-ink">Every answer</h3>
          <ul className="space-y-4">
            {answers.map((a) => (
              <li
                key={a.id}
                className="rounded-surface border border-navy-100/70 bg-surface p-5 shadow-raised"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    tone={a.score >= 85 ? "ready" : a.score >= 60 ? "pending" : "attention"}
                  >
                    {a.score}%
                  </Badge>
                </div>
                <p className="font-display text-base leading-snug text-ink">{a.question}</p>

                <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  You said
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                  {a.answer.trim() || <span className="text-ink-muted">Nothing given.</span>}
                </p>

                <div className="mt-3 rounded-lg border-l-2 border-navy-500 bg-navy-050/60 py-3 pl-4 pr-3">
                  <p className="label-eyebrow">
                    Your project says
                  </p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {a.model_answer}
                  </p>
                </div>

                {a.feedback && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-muted">{a.feedback}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  // ---- in progress -------------------------------------------------------
  const chapters = DEFENSE_SCOPES.find((s) => s.value === session.scope)!.chapters;
  const answered = new Set(answers.map((a) => a.question_id));

  const { data: questionRows } = await supabase
    .from("questions")
    .select("*")
    .eq("project_id", id)
    .in("chapter", chapters)
    .order("confidence", { ascending: true, nullsFirst: true })
    .order("last_seen_at", { ascending: true, nullsFirst: true });

  const queue = ((questionRows ?? []) as Question[])
    .filter((q) => !answered.has(q.id))
    .slice(0, Math.max(0, DEFENSE_SITTING_LENGTH - answers.length));

  return (
    <Sitting
      projectId={id}
      sessionId={sessionId}
      queue={queue}
      alreadyAnswered={answers.length}
      total={Math.min(DEFENSE_SITTING_LENGTH, answers.length + queue.length)}
    />
  );
}
