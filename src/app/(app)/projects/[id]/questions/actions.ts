"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requestQuestions } from "@/lib/n8n";
import { withUsage } from "@/lib/usage";
import { DEFENSE_SCOPES, type DefenseScope } from "@/lib/types";
import { toFieldErrors } from "@/lib/validation/auth";

export type QuestionsState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string[]>;
};

const generateSchema = z.object({
  projectId: z.string().uuid(),
  scope: z.enum(["chapter", "proposal", "final"]),
  count: z.coerce.number().int().min(3).max(30).default(12),
});

/**
 * How many chunks to send. Enough to write varied questions across the project without
 * sending an entire thesis to the model on every click - which would be slow and would
 * make Phase 4 the most expensive thing in the product.
 */
const MAX_CHUNKS = 40;

/**
 * Generate defense questions from the student's own chapters.
 *
 * Chunks are read straight from Postgres under the student's session rather than through
 * the vector index. That is deliberate: retrieval finds passages *similar to a question*,
 * but here there is no question yet - we want coverage. Reading rows directly also keeps
 * Pinecone, and its cost, out of this path entirely.
 */
export async function generateQuestions(
  _prev: QuestionsState,
  formData: FormData,
): Promise<QuestionsState> {
  const parsed = generateSchema.safeParse({
    projectId: formData.get("projectId"),
    scope: formData.get("scope"),
    count: formData.get("count") ?? 12,
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { projectId, scope, count } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return { error: "That project could not be found." };

  if (!process.env.N8N_QUESTIONS_WEBHOOK_URL) {
    return {
      error:
        "Question generation is not connected yet. Once the workflow is wired up, your " +
        "chapters become practice questions.",
    };
  }

  const chapters = DEFENSE_SCOPES.find((s) => s.value === scope)!.chapters;

  // Only embedded chunks: a chunk that never made it into the index is one the rest of the
  // product cannot cite, so building questions on it would produce a flashcard whose source
  // cannot be looked up.
  const { data: rows, error: readError } = await supabase
    .from("chunks")
    .select("id, chapter, label, content")
    .eq("project_id", projectId)
    .eq("embedded", true)
    .in("chapter", chapters)
    .order("chapter", { ascending: true })
    .order("chunk_index", { ascending: true });

  if (readError) {
    console.error("[generateQuestions] chunk read failed", readError);
    return { error: "Your project text could not be read. Please try again." };
  }

  const all = rows ?? [];
  if (all.length === 0) {
    return {
      error:
        "There is nothing indexed for those chapters yet. Upload a chapter and wait for it " +
        "to finish reading, then try again.",
    };
  }

  // Even spread rather than the first 40 chunks, which would be the opening pages only and
  // would produce a dozen questions about the background of the study.
  const step = Math.max(1, Math.ceil(all.length / MAX_CHUNKS));
  const sampled = all.filter((_, i) => i % step === 0).slice(0, MAX_CHUNKS);

  let generated;
  try {
    const result = await withUsage(
      supabase,
      {
        userId: user.id,
        projectId,
        operation: "questions",
        chunksSent: sampled.length,
      },
      () =>
        requestQuestions({
          projectId,
          userId: user.id,
          scope: scope as DefenseScope,
          count,
          chunks: sampled.map((c) => ({
            id: c.id as string,
            chapter: c.chapter as number | null,
            label: c.label as string | null,
            content: c.content as string,
          })),
        }),
      (r) => r.questions?.length ?? 0,
    );
    generated = result.questions;
  } catch (err) {
    console.error("[generateQuestions] generation failed", err);
    return { error: "The questions could not be generated. Please try again." };
  }

  if (!generated?.length) {
    return { error: "No questions came back. Please try again." };
  }

  const toInsert = generated.map((q) => {
    const sources = q.sourceIndexes
      .map((i) => sampled[i])
      .filter((c): c is (typeof sampled)[number] => Boolean(c));

    // A question is tagged with a chapter only when every source agrees on one. Anything
    // spanning chapters stays null rather than being filed under whichever came first.
    const chapterSet = new Set(sources.map((c) => c.chapter));

    return {
      project_id: projectId,
      // user_id is set by the questions_inherit_project() trigger from the parent project,
      // but RLS still checks it on insert, so it is sent too.
      user_id: user.id,
      chapter: chapterSet.size === 1 ? ([...chapterSet][0] as number | null) : null,
      question: q.question,
      model_answer: q.answer,
      source_chunk_ids: sources.map((c) => c.id as string),
      difficulty: q.difficulty,
      // The database constraint requires both or neither, which is also what quiz mode
      // needs: a question with options but no correct index is an unanswerable screen.
      options: q.options && q.correct !== null ? q.options : null,
      correct_option: q.options && q.correct !== null ? q.correct : null,
    };
  });

  const { error: insertError } = await supabase.from("questions").insert(toInsert);

  if (insertError) {
    console.error("[generateQuestions] insert failed", insertError);
    return { error: "The questions could not be saved. Please try again." };
  }

  revalidatePath(`/projects/${projectId}/questions`);
  return {
    notice: `${toInsert.length} question${toInsert.length === 1 ? "" : "s"} ready.`,
  };
}

const reviewSchema = z.object({
  questionId: z.string().uuid(),
  projectId: z.string().uuid(),
  confidence: z.coerce.number().int().min(1).max(3),
});

/**
 * Record how the student felt about a question after seeing the answer.
 *
 * Self-reported on purpose. Phase 5 grades typed answers against the project, but this is
 * revision, and a student who has just read their own words is the best judge of whether
 * they could say them under pressure. It is also the honest input for a readiness score:
 * a number built from "I marked myself shaky on nine of these" means something, whereas one
 * built from nothing at all does not.
 */
export async function recordConfidence(formData: FormData): Promise<void> {
  const parsed = reviewSchema.safeParse({
    questionId: formData.get("questionId"),
    projectId: formData.get("projectId"),
    confidence: formData.get("confidence"),
  });

  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("questions")
    .select("times_seen")
    .eq("id", parsed.data.questionId)
    .maybeSingle();

  // RLS already scopes this to the student's own rows, so a missing row means it is not
  // theirs or no longer exists - either way there is nothing to update.
  if (!existing) return;

  await supabase
    .from("questions")
    .update({
      confidence: parsed.data.confidence,
      times_seen: (existing.times_seen as number) + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.questionId);

  revalidatePath(`/projects/${parsed.data.projectId}/questions`);
}
