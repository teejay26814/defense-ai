import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { GenerateForm } from "./generate-form";
import { QuestionDeck } from "./question-deck";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import type { Question } from "@/lib/types";

export const metadata: Metadata = { title: "Practice questions" };

/**
 * Practice questions for one project.
 *
 * Ordering is the feature. Unanswered first, then the ones marked shaky, then by how long
 * ago they were last seen - so opening this page always puts the weakest material in front
 * of the student rather than making them scroll for it.
 */
export default async function QuestionsPage({
  params,
}: PageProps<"/projects/[id]/questions">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  // A genuine query failure and "not your project" both end as a 404 for the student, but
  // only one of them is a bug, so the error is logged before they become indistinguishable.
  if (projectError) console.error("[questions] project lookup failed", projectError);

  // RLS makes another student's project indistinguishable from one that does not exist,
  // which is exactly right - a 404 leaks nothing about what other people have.
  if (!project) notFound();

  const { data: questionRows } = await supabase
    .from("questions")
    .select("*")
    .eq("project_id", id)
    .order("confidence", { ascending: true, nullsFirst: true })
    .order("last_seen_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  const questions = (questionRows ?? []) as Question[];

  // Which chapters actually have indexed text, so the scope selector can default to
  // something that will work rather than to "final" on a project with one chapter.
  const { data: indexedRows } = await supabase
    .from("chunks")
    .select("chapter")
    .eq("project_id", id)
    .eq("embedded", true);

  const indexedChapters = new Set(
    (indexedRows ?? []).map((r) => r.chapter as number | null).filter((c): c is number => c !== null),
  );

  const defaultScope =
    indexedChapters.size >= 4 ? "final" : indexedChapters.size >= 2 ? "proposal" : "chapter";

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-3xl text-ink">Practice questions</h2>
        <p className="measure mt-3 text-ink-muted">
          Questions a panel would actually ask, written from your own chapters. Try to
          answer out loud before you reveal what your project says.
        </p>
      </header>

      <Card elevation="base">
        <CardTitle className="font-display">Generate questions</CardTitle>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          {indexedChapters.size === 0
            ? "Nothing is indexed yet. Upload a chapter first."
            : `${indexedChapters.size} chapter${indexedChapters.size === 1 ? "" : "s"} indexed and ready to draw from.`}
        </p>
        <GenerateForm projectId={project.id} defaultScope={defaultScope} />
      </Card>

      {questions.length > 0 && (
        <QuestionDeck
          questions={questions}
          projectId={project.id}
          quizHref={`/projects/${project.id}/quiz`}
        />
      )}

      {questions.length === 0 && indexedChapters.size > 0 && (
        <EmptyState
          title="No questions yet"
          description="Generate a set above. They are written only from the chapters you have uploaded, so every one of them is about your actual project."
        />
      )}
    </div>
  );
}
