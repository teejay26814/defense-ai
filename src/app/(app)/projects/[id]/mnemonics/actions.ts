"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requestMnemonics } from "@/lib/n8n";
import { withUsage } from "@/lib/usage";
import { toFieldErrors } from "@/lib/validation/auth";

export type MnemonicsState = {
  error?: string;
  notice?: string;
  fieldErrors?: Record<string, string[]>;
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

  let generated;
  try {
    const result = await withUsage(
      supabase,
      {
        userId: user.id,
        projectId,
        operation: "mnemonics",
        chunksSent: sampled.length,
      },
      () =>
        requestMnemonics({
          projectId,
          userId: user.id,
          chunks: sampled.map((c) => ({
            id: c.id as string,
            chapter: c.chapter as number | null,
            label: c.label as string | null,
            content: c.content as string,
          })),
        }),
      (r) => r.mnemonics?.length ?? 0,
    );
    generated = result.mnemonics;
  } catch (err) {
    console.error("[generateMnemonics] generation failed", err);
    return { error: "The memory aids could not be generated. Please try again." };
  }

  if (!generated?.length) {
    return {
      error:
        "No clear lists were found in your chapters yet. Memory aids work best on numbered " +
        "objectives, research questions, or limitations.",
    };
  }

  await supabase.from("mnemonics").delete().eq("project_id", projectId);

  const toInsert = generated.map((m) => {
    const sources = m.sourceIndexes
      .map((i) => sampled[i])
      .filter((c): c is (typeof sampled)[number] => Boolean(c));
    const chapters = new Set(sources.map((c) => c.chapter));

    return {
      project_id: projectId,
      user_id: user.id,
      chapter: chapters.size === 1 ? ([...chapters][0] as number | null) : null,
      title: m.title,
      items: m.items,
      aid: m.aid,
      explanation: m.explanation,
    };
  });

  const { error: insertError } = await supabase.from("mnemonics").insert(toInsert);

  if (insertError) {
    console.error("[generateMnemonics] insert failed", insertError);
    return { error: "The memory aids could not be saved. Please try again." };
  }

  revalidatePath(`/projects/${projectId}/mnemonics`);
  return {
    notice: `${toInsert.length} memory aid${toInsert.length === 1 ? "" : "s"} ready.`,
  };
}
