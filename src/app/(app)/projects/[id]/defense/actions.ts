"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fireBackgroundJob } from "@/lib/background-job";
import {
  assertDefenseAllowance,
  currentPlan,
  PlanLimitError,
  PLANS,
  planWindowStart,
  takeAiSlot,
} from "@/lib/plans";
import { DEFENSE_SCOPES } from "@/lib/types";
import { toFieldErrors } from "@/lib/validation/auth";

export type DefenseState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set once a background job has been started, so the sitting can poll it. */
  jobId?: string;
};

const startSchema = z.object({
  projectId: z.string().uuid(),
  scope: z.enum(["chapter", "proposal", "final"]),
});

/**
 * Open a sitting.
 *
 * Questions are chosen weakest first - unrated, then the ones the student marked shaky,
 * then longest unseen. A mock defense that asked the material they already know would
 * produce a flattering score and teach nothing.
 */
export async function startDefense(
  _prev: DefenseState,
  formData: FormData,
): Promise<DefenseState> {
  const parsed = startSchema.safeParse({
    projectId: formData.get("projectId"),
    scope: formData.get("scope"),
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { projectId, scope } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Plan first, then pace. Starting a sitting is what commits the AI spend for marking it,
  // so this is where mock-defense cost is bounded - not in the UI.
  try {
    const { plan } = await assertDefenseAllowance(supabase, user.id);
    await takeAiSlot(supabase, "defense", plan);
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }

  const chapters = DEFENSE_SCOPES.find((s) => s.value === scope)!.chapters;

  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("chapter", chapters);

  if ((count ?? 0) === 0) {
    return {
      error:
        "There are no questions for those chapters yet. Generate a set on the Practice tab " +
        "first, then sit the defense.",
    };
  }

  const { data: session, error } = await supabase
    .from("defense_sessions")
    .insert({ project_id: projectId, user_id: user.id, scope })
    .select("id")
    .single();

  if (error || !session) {
    console.error("[startDefense] insert failed", error);
    return { error: "The sitting could not be started. Please try again." };
  }

  redirect(`/projects/${projectId}/defense/${session.id}`);
}

const answerSchema = z.object({
  sessionId: z.string().uuid(),
  projectId: z.string().uuid(),
  questionId: z.string().uuid(),
  // Deliberately not required. Drawing a blank is a real outcome in a defense, and a
  // student who skips is told what their project says, which is the useful part.
  answer: z.string().max(5000, "That answer is too long.").optional().default(""),
});

/**
 * Mark one answer and store it.
 *
 * The reference answer is read here, under the student's session, and handed to a Netlify
 * Background Function along with the question - nothing else: no chunks, no project. An
 * examiner that can see the whole project starts marking the project, which is the one
 * thing this must not do.
 *
 * Marking does not happen in this request. It is a real model call and can run past
 * Netlify's 10-second limit on a synchronous function - confirmed live: a marking attempt
 * left no record in ai_usage at all, the same signature as the questions bug before it,
 * because the process that would have logged the failure was the one being killed. This
 * action does the fast, RLS-checked part and hands the marking off; the sitting polls
 * `getGenerationJobStatus` and moves to the next question once the answer is saved.
 */
export async function submitAnswer(
  _prev: DefenseState,
  formData: FormData,
): Promise<DefenseState> {
  const parsed = answerSchema.safeParse({
    sessionId: formData.get("sessionId"),
    projectId: formData.get("projectId"),
    questionId: formData.get("questionId"),
    answer: formData.get("answer") ?? "",
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { sessionId, projectId, questionId, answer } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: question } = await supabase
    .from("questions")
    .select("id, question, model_answer")
    .eq("id", questionId)
    .maybeSingle();

  if (!question) return { error: "That question could not be found." };

  // Every answer is a paid marking call, so the sitting itself is checked here, not only
  // when it was opened: it must be this student's, still open, within the sittings their
  // plan allows (a session inserted straight through the API would otherwise get marked),
  // and not already holding as many answers as the plan's sitting length.
  const { data: session } = await supabase
    .from("defense_sessions")
    .select("id, status, started_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) return { error: "That sitting could not be found." };
  if (session.status !== "in_progress") return { error: "This sitting is already closed." };

  const plan = await currentPlan(supabase);
  const { defense: sittingLimit, sittingLength } = PLANS[plan];

  const windowStart = await planWindowStart(supabase, plan);
  let earlier = supabase
    .from("defense_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .lte("started_at", session.started_at as string);
  if (windowStart) earlier = earlier.gte("started_at", windowStart);
  const [{ count: sittingNumber }, { count: answered }] = await Promise.all([
    earlier,
    supabase
      .from("defense_answers")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId),
  ]);

  if ((sittingNumber ?? 0) > sittingLimit) {
    return { error: "This sitting is outside your plan's mock defenses." };
  }
  if ((answered ?? 0) >= sittingLength) {
    return { notice: "This sitting is complete." };
  }

  // Already answered in this sitting? Answers are a record of what was said under pressure,
  // so a second submission is ignored rather than allowed to overwrite the first.
  const { data: existing } = await supabase
    .from("defense_answers")
    .select("id")
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (existing) return { notice: "Already answered." };

  if (!process.env.N8N_EVALUATE_WEBHOOK_URL) {
    return { error: "Marking is not connected yet." };
  }

  try {
    await takeAiSlot(supabase, "evaluate", plan);
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      operation: "evaluate",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("[submitAnswer] job creation failed", jobError);
    return { error: "Could not start marking. Please try again." };
  }

  try {
    await fireBackgroundJob("evaluate-answer", {
      jobId: job.id as string,
      sessionId,
      projectId,
      userId: user.id,
      questionId,
      question: question.question as string,
      answer,
      modelAnswer: question.model_answer as string,
    });
  } catch (err) {
    console.error("[submitAnswer] background hand-off failed", err);
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error: "Could not start marking." })
      .eq("id", job.id as string);
    return { error: "Could not start marking. Please try again." };
  }

  return { jobId: job.id as string, notice: "Marking…" };
}

const finishSchema = z.object({
  sessionId: z.string().uuid(),
  projectId: z.string().uuid(),
});

/**
 * Close the sitting.
 *
 * The score is computed by close_defense_session() in Postgres rather than here, so it can
 * only ever be derived from answers that exist. A readiness figure the client could supply
 * would not be a readiness figure.
 */
export async function finishDefense(
  _prev: DefenseState,
  formData: FormData,
): Promise<DefenseState> {
  const parsed = finishSchema.safeParse({
    sessionId: formData.get("sessionId"),
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_defense_session", {
    session: parsed.data.sessionId,
  });

  if (error) {
    console.error("[finishDefense] close failed", error);
    return { error: "The sitting could not be closed. Please try again." };
  }

  revalidatePath(`/projects/${parsed.data.projectId}/defense/${parsed.data.sessionId}`);
  redirect(`/projects/${parsed.data.projectId}/defense/${parsed.data.sessionId}`);
}

