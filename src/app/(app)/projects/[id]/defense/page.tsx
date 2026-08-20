import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { StartForm } from "./start-form";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { readinessBand, type DefenseSession } from "@/lib/types";

export const metadata: Metadata = { title: "Mock defense" };

/**
 * The mock defense, and the history of past sittings.
 *
 * Past sittings are shown because improvement is the point. A single score is a verdict; a
 * sequence of them is progress, and progress is what keeps a nervous student practising.
 */
export default async function DefensePage({
  params,
}: PageProps<"/projects/[id]/defense">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: sessionRows } = await supabase
    .from("defense_sessions")
    .select("*")
    .eq("project_id", id)
    .order("started_at", { ascending: false });

  const sessions = (sessionRows ?? []) as DefenseSession[];
  const complete = sessions.filter((s) => s.status === "complete" && s.readiness !== null);
  const open = sessions.find((s) => s.status === "in_progress");

  const { count: questionCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  const best = complete.length > 0 ? Math.max(...complete.map((s) => s.readiness!)) : null;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-2xl text-ink">Mock defense</h2>
        <p className="mt-2 max-w-prose text-ink-muted">
          Answer as you would in the room, in your own words, without looking anything up.
          Each answer is marked against what your project actually says.
        </p>
      </header>

      {open && (
        <Card elevation="elevated" className="bloom">
          <CardTitle className="font-display">You have a sitting open</CardTitle>
          <p className="mt-1 mb-4 text-sm text-ink-muted">
            Started {new Date(open.started_at).toLocaleString()}.
          </p>
          <Link href={`/projects/${id}/defense/${open.id}`} className={buttonStyles()}>
            Continue it
          </Link>
        </Card>
      )}

      {(questionCount ?? 0) === 0 ? (
        <EmptyState
          title="Generate some questions first"
          description="A mock defense asks the questions already written from your chapters, so there need to be some. It takes about a minute on the Practice tab."
          action={
            <Link href={`/projects/${id}/questions`} className={buttonStyles()}>
              Go to Practice
            </Link>
          }
        />
      ) : (
        !open && (
          <Card elevation="base">
            <CardTitle className="font-display">Sit a defense</CardTitle>
            <p className="mt-1 mb-4 text-sm text-ink-muted">
              Eight questions, weakest material first. Around ten minutes.
            </p>
            <StartForm projectId={id} />
          </Card>
        )
      )}

      {complete.length > 0 && (
        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-xl text-ink">Past sittings</h3>
            {best !== null && (
              <p className="text-sm text-ink-muted">Best so far: {best}%</p>
            )}
          </div>

          <ul className="stagger-children space-y-2.5">
            {complete.map((s) => {
              const band = readinessBand(s.readiness!);
              return (
                <li key={s.id}>
                  <Link
                    href={`/projects/${id}/defense/${s.id}`}
                    className="flex items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 shadow-base
                      transition-[transform,box-shadow,border-color] duration-150
                      hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-elevated
                      active:translate-y-0"
                  >
                    <span className="font-sans text-2xl font-semibold tabular-nums text-ink">
                      {s.readiness}
                      <span className="text-sm font-medium text-ink-muted">%</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{band.label}</span>
                      <span className="block text-xs text-ink-muted">
                        {new Date(s.started_at).toLocaleDateString()}
                      </span>
                    </span>
                    <Badge tone="neutral">{s.scope}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
