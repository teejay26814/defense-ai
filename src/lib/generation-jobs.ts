"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Polled by whichever page started a background generation (questions, mnemonics, a mock
 * defense answer). One status shape for all three, since the job row itself is one table -
 * RLS scopes this to the student's own job regardless of which operation it was.
 */

const jobStatusSchema = z.object({ jobId: z.string().uuid() });

export type GenerationJobStatus = {
  status: "pending" | "succeeded" | "failed";
  resultCount: number | null;
  error: string | null;
};

export async function getGenerationJobStatus(
  jobId: string,
): Promise<GenerationJobStatus | null> {
  const parsed = jobStatusSchema.safeParse({ jobId });
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("generation_jobs")
    .select("status, result_count, error")
    .eq("id", parsed.data.jobId)
    .maybeSingle();

  if (!data) return null;

  return {
    status: data.status as GenerationJobStatus["status"],
    resultCount: data.result_count as number | null,
    error: data.error as string | null,
  };
}
