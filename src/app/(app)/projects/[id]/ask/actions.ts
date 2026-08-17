"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { citedChunkIds, type SourceChunk } from "@/lib/llm";
import { namespaceFor, requestAnswer, requestRetrieval } from "@/lib/n8n";
import { toFieldErrors } from "@/lib/validation/auth";

export type AskState = {
  error?: string;
  question?: string;
  answer?: string;
  sources?: {
    id: string;
    chapter: number | null;
    label: string | null;
    excerpt: string;
    cited: boolean;
  }[];
  fieldErrors?: Record<string, string[]>;
};

const askSchema = z.object({
  projectId: z.string().uuid(),
  question: z
    .string()
    .trim()
    .min(5, "Ask a fuller question — a few words is not enough to search on.")
    .max(2000, "That question is too long."),
});

/** How many chunks to retrieve. Enough context to answer without burning tokens. */
const TOP_K = 8;

/**
 * Ask a question about the student's own project.
 *
 * The sequence is the security model, not just the data flow:
 *
 *   1. n8n searches the vector index and returns chunk ids — never text.
 *   2. Those ids are hydrated through chunks_by_ids(), a security-invoker function, using
 *      this request's Supabase client. RLS therefore decides what comes back.
 *   3. Only what survived step 2 is put in front of the model.
 *
 * So even if the index returned ids from another student's namespace, nothing of theirs
 * could reach the prompt — the hydration would simply drop them.
 */
export async function askProject(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const parsed = askSchema.safeParse({
    projectId: formData.get("projectId"),
    question: formData.get("question"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: toFieldErrors(parsed.error),
      question: String(formData.get("question") ?? ""),
    };
  }

  const { projectId, question } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Confirm the project is this student's before anything else. RLS would catch it, but
  // this turns a silent empty result into a clear message.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return { error: "That project could not be found.", question };

  if (!process.env.N8N_QUERY_WEBHOOK_URL || !process.env.N8N_ANSWER_WEBHOOK_URL) {
    return {
      error:
        "Search is not connected yet. Once the retrieval workflow is wired up, your " +
        "uploaded chapters become askable.",
      question,
    };
  }

  let matches;
  try {
    ({ matches } = await requestRetrieval({
      projectId,
      userId: user.id,
      namespace: namespaceFor(user.id, projectId),
      question,
      topK: TOP_K,
    }));
  } catch (err) {
    console.error("[askProject] retrieval failed", err);
    return { error: "Search is unavailable right now. Please try again.", question };
  }

  if (!matches?.length) {
    return {
      error:
        "Nothing in your uploaded chapters matched that. Try rewording it, or upload the " +
        "chapter that covers it.",
      question,
    };
  }

  // Hydration under the student's session — this is where RLS applies.
  const { data: hydrated, error: hydrateError } = await supabase.rpc("chunks_by_ids", {
    chunk_ids: matches.map((m) => m.chunkId),
  });

  if (hydrateError) {
    console.error("[askProject] hydration failed", hydrateError);
    return { error: "Your project text could not be read. Please try again.", question };
  }

  const chunks = (hydrated ?? []) as SourceChunk[];
  if (chunks.length === 0) {
    return {
      error:
        "The matching sections are no longer available. Re-uploading the chapter will " +
        "rebuild the index.",
      question,
    };
  }

  try {
    // Chunk order is the citation contract: n8n numbers these as it receives them, and
    // citedChunkIds() maps `[n]` back by position. Send them exactly as hydrated.
    const { answer } = await requestAnswer({
      projectId,
      userId: user.id,
      question,
      chunks: chunks.map((c) => ({
        id: c.id,
        chapter: c.chapter,
        label: c.label,
        content: c.content,
      })),
    });

    if (!answer?.trim()) {
      return { error: "The answer came back empty. Please try again.", question };
    }

    const cited = new Set(citedChunkIds(answer, chunks));

    return {
      question,
      answer: answer.trim(),
      sources: chunks.map((c) => ({
        id: c.id,
        chapter: c.chapter,
        label: c.label,
        excerpt: c.content.slice(0, 240).trim(),
        cited: cited.has(c.id),
      })),
    };
  } catch (err) {
    // Provider and workflow errors are logged in full but never surfaced — they can carry
    // key fragments, model routing details, and account information.
    console.error("[askProject] generation failed", err);
    return { error: "The answer could not be generated. Please try again.", question };
  }
}
