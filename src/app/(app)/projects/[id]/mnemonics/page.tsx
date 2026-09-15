import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { GenerateMnemonicsForm } from "./generate-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import type { Mnemonic } from "@/lib/types";

export const metadata: Metadata = { title: "Memory aids" };

/**
 * Memory aids for the lists a student has to recite under pressure.
 *
 * The aid and the list are shown side by side rather than the aid alone. A hook you cannot
 * check against the real list is just another thing to memorise wrongly, and the whole
 * point is that these come from the student's own wording.
 */
export default async function MnemonicsPage({
  params,
}: PageProps<"/projects/[id]/mnemonics">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project, error: projectError }, { data: rows }] = await Promise.all([
    supabase.from("projects").select("id").eq("id", id).maybeSingle(),
    supabase
      .from("mnemonics")
      .select("*")
      .eq("project_id", id)
      .order("chapter", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  if (projectError) console.error("[mnemonics] project lookup failed", projectError);
  if (!project) notFound();

  const mnemonics = (rows ?? []) as Mnemonic[];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-3xl text-ink">Memory aids</h2>
        <p className="measure mt-3 text-ink-muted">
          Hooks for the lists you have to recite in order: your objectives, your research
          questions, your limitations. Built from your own wording, so what you memorise is
          what you wrote.
        </p>
      </header>

      <Card elevation="base">
        <CardTitle className="font-display">
          {mnemonics.length > 0 ? "Rebuild" : "Build your memory aids"}
        </CardTitle>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Finds the ordered lists in your chapters and gives each one a hook.
        </p>
        <GenerateMnemonicsForm projectId={project.id} hasExisting={mnemonics.length > 0} />
      </Card>

      {mnemonics.length === 0 ? (
        <EmptyState
          title="No memory aids yet"
          description="Build a set above. If your chapters have numbered objectives or research questions, those are what these work best on."
        />
      ) : (
        <ul className="stagger-children border-t border-navy-100">
          {mnemonics.map((m) => (
            <li
              key={m.id}
              className="rule-hairline py-7"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg text-ink">{m.title}</h3>
                {m.chapter && <Badge tone="info">Chapter {m.chapter}</Badge>}
                <Badge tone="neutral">
                  {m.items.length} item{m.items.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {/* The hook, given the weight it needs to actually stick. */}
              <div className="bloom rounded-lg border-l-2 border-navy-500 bg-navy-050/60 py-4 pl-4 pr-3">
                <p className="label-eyebrow">
                  Remember it as
                </p>
                <p className="mt-2 font-display text-2xl leading-snug text-ink">{m.aid}</p>
                {m.explanation && (
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {m.explanation}
                  </p>
                )}
              </div>

              {/* What it stands for, in the project's own order and words. */}
              <ol className="mt-4 space-y-2">
                {m.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-navy-050 text-xs font-semibold text-brand">
                      {i + 1}
                    </span>
                    <span className="text-ink">{item}</span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
