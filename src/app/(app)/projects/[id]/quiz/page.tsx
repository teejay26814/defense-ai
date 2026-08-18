import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { QuizRunner } from "./quiz-runner";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import type { Question } from "@/lib/types";

export const metadata: Metadata = { title: "Quiz" };

/** Enough for a real sitting without becoming a chore. */
const QUIZ_LENGTH = 10;

export default async function QuizPage({ params }: PageProps<"/projects/[id]/quiz">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (projectError) console.error("[quiz] project lookup failed", projectError);
  if (!project) notFound();

  // Only questions that actually have choices. Anything generated before quiz mode existed
  // has none, and is still perfectly usable as a flashcard.
  const { data: rows } = await supabase
    .from("questions")
    .select("*")
    .eq("project_id", id)
    .not("options", "is", null)
    .order("confidence", { ascending: true, nullsFirst: true })
    .order("last_seen_at", { ascending: true, nullsFirst: true });

  // Ordered weakest first by the query: unrated questions, then the ones marked shaky, then
  // by how long since they were last seen. Deliberately not shuffled - the point of a
  // sitting is to hit the weak material, and the order shifts on its own as ratings change.
  const questions = (rows ?? []).slice(0, QUIZ_LENGTH) as Question[];

  return (
    <div className="space-y-8">
      <header>
        <Link
          href={`/projects/${project.id}`}
          className="rounded text-sm text-navy-500 underline-offset-4
            transition-colors duration-150 hover:text-navy-700 hover:underline"
        >
          ← {project.title}
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink">Quiz</h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Multiple choice, drawn from your own chapters. Every option is something your
          project could plausibly have said, so read carefully.
        </p>
      </header>

      {questions.length === 0 ? (
        <EmptyState
          title="No quiz questions yet"
          description="Generate a set of questions first. New ones come with multiple choice built in, so they work as both flashcards and a quiz."
          action={
            <Link href={`/projects/${project.id}/questions`} className={buttonStyles()}>
              Generate questions
            </Link>
          }
        />
      ) : (
        <QuizRunner questions={questions} projectId={project.id} />
      )}
    </div>
  );
}
