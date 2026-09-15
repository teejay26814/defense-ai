"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { fireBackgroundJob } from "@/lib/background-job";
import { assertWithinPlan, PlanLimitError } from "@/lib/plans";
import { toFieldErrors } from "@/lib/validation/auth";

export type MnemonicsState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string[]>;
  /** Set once a background job has been started, so the form can poll it. */
  jobId?: string;
};

const schema = z.object({ projectId: z.string().uuid() });

/** Enough to find the lists without sending the whole project. */
const MAX_CHUNKS = 30;

/**
 * Build memory aids from the ordered lists in the student's own chapters.
 *
 * Chunks are read straight from Postgres rather than through the vector index, for the
 * same reason as question generation: there is no query to be similar to, and the job is
 * coverage.
 *
 * Regenerating replaces rather than appends. A student pressing the button twice wants a
 * better set, not two competing mnemonics for the same list, and duplicates would be worse
 * than useless for memorising.
 */
export async function generateMnemonics(
  _prev: MnemonicsState,
  formData: FormData,
): Promise<MnemonicsState> {
  const parsed = schema.safeParse({ projectId: formData.get("projectId") });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { projectId } = parsed.data;

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
    await assertWithinPlan(supabase, user.id, "mnemonics");
  } catch (err) {
    if (err instanceof PlanLimitError) return { error: err.message };
    throw err;
  }

  if (!process.env.N8N_MNEMONICS_WEBHOOK_URL) {
    return { error: "Memory aids are not connected yet." };
  }

  const { data: rows, error: readError } = await supabase
    .from("chunks")
    .select("id, chapter, label, content")
    .eq("project_id", projectId)
    .eq("embedded", true)
    .order("chapter", { ascending: true })
    .order("chunk_index", { ascending: true });

  if (readError) {
    console.error("[generateMnemonics] chunk read failed", readError);
    return { error: "Your project text could not be read. Please try again." };
  }

  const all = rows ?? [];
  if (all.length === 0) {
    return { error: "There is nothing indexed yet. Upload a chapter and let it finish." };
  }

  // Lists live near the front of a chapter, in the objectives and scope, so this favours
  // the opening chunks rather than sampling evenly across the whole project.
  const sampled = all.slice(0, MAX_CHUNKS);

  const { data: job, error: jobError } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      operation: "mnemonics",
    })
    .select("id")
    .single();

  if (jobError || !job) {
    console.error("[generateMnemonics] job creation failed", jobError);
    return { error: "Could not start generation. Please try again." };
  }

  try {
    await fireBackgroundJob("generate-mnemonics", {
      jobId: job.id as string,
      projectId,
      userId: user.id,
      chunks: sampled.map((c) => ({
        id: c.id as string,
        chapter: c.chapter as number | null,
        label: c.label as string | null,
        content: c.content as string,
      })),
    });
  } catch (err) {
    console.error("[generateMnemonics] background hand-off failed", err);
    await supabase
      .from("generation_jobs")
      .update({ status: "failed", error: "Could not start generation." })
      .eq("id", job.id as string);
    return { error: "Could not start generation. Please try again." };
  }

  return {
    jobId: job.id as string,
    notice: "Looking for the lists in your chapters - this can take up to a minute.",
  };
}
