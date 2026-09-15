"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fireBackgroundJob } from "@/lib/background-job";
import { assertWithinPlan, PlanLimitError } from "@/lib/plans";
import { DEFENSE_SCOPES } from "@/lib/types";
import { toFieldErrors } from "@/lib/validation/auth";

export type QuestionsState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set once a background job has been started, so the form can poll it. */
  jobId?: string;
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
 * Start generating defense questions from the student's own chapters.
 *
 * Chunks are read straight from Postgres under the student's session rather than through
 * the vector index. That is deliberate: retrieval finds passages *similar to a question*,
 * but here there is no question yet - we want coverage. Reading rows directly also keeps
 * Pinecone, and its cost, out of this path entirely.
 *
 * The actual call to n8n does not happen here. A real question set takes 30-90 seconds,
 * and Netlify kills a normal request at 10 - long enough that every live attempt was
 * getting cut off mid-generation, with nothing saved and no record of what happened,
 * because the process logging the failure was the one being killed. This action does the
 * fast, RLS-checked part (auth, plan limit, reading chunks) and hands off the slow part to
 * a Netlify Background Function, which gets up to 15 minutes. The form polls
 * `getGenerationJobStatus` for the result.
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

  // Checked in the action, before the AI call, never in the UI. A disabled button is
  // a courtesy; this is the boundary.
  try {
    await assertWithinPlan(supabase, user.id, "questions");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }

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

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      operation: "questions",
      params: { scope, count },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("[generateQuestions] job creation failed", jobError);
    return { error: "Could not start generation. Please try again." };
  }

  try {
    await fireBackgroundJob("generate-questions", {
      jobId: job.id as string,
      projectId,
      userId: user.id,
      scope,
      count,
      chunks: sampled.map((c) => ({
        id: c.id as string,
        chapter: c.chapter as number | null,
        label: c.label as string | null,
        content: c.content as string,
      })),
    });
  } catch (err) {
    console.error("[generateQuestions] background hand-off failed", err);
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error: "Could not start generation." })
      .eq("id", job.id as string);
    return { error: "Could not start generation. Please try again." };
  }

  return {
    jobId: job.id as string,
    notice: "Generating your questions - this can take up to a minute.",
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
