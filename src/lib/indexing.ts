import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkText } from "@/lib/chunk";
import { namespaceFor, requestEmbedding } from "@/lib/n8n";

/**
 * Turns an extracted document into retrievable chunks.
 *
 * Runs inside a server action, so the Supabase client passed in still carries the
 * student's session - every write below happens under RLS. That is the whole reason
 * chunking lives here rather than in n8n: n8n has no session, so it would need the
 * service-role key, which bypasses RLS entirely.
 *
 * Order matters. Rows are written first and only marked `embedded` once the index
 * confirms them, so a failure halfway leaves rows that are simply not yet retrievable
 * rather than rows that claim to be indexed and are not.
 */

export type IndexResult = {
  chunkCount: number;
  embeddedCount: number;
  /** Set when chunks were stored but not indexed, with a reason the student can act on. */
  skipped?: string;
};

export async function indexDocument(
  supabase: SupabaseClient,
  params: {
    documentId: string;
    projectId: string;
    userId: string;
    text: string;
  },
): Promise<IndexResult> {
  const { documentId, projectId, userId, text } = params;

  // Re-indexing replaces rather than appends. Without this a retry would duplicate every
  // chunk, and the unique (document_id, chunk_index) constraint would reject it anyway.
  await supabase
    .from("chunks")
    .delete()
    .eq("document_id", documentId)
    .eq("user_id", userId);

  const pieces = chunkText(text);
  if (pieces.length === 0) {
    return { chunkCount: 0, embeddedCount: 0, skipped: "nothing to index" };
  }

  const { data: rows, error } = await supabase
    .from("chunks")
    .insert(
      pieces.map((p) => ({
        document_id: documentId,
        project_id: projectId,
        user_id: userId,
        chunk_index: p.index,
        content: p.content,
        token_count: p.tokenCount,
      })),
    )
    .select("id, chunk_index");

  if (error || !rows) {
    console.error("[indexDocument] chunk insert failed", error);
    throw new Error("The document could not be split for search.");
  }

  // Degrade rather than fail when the orchestration layer is not configured yet. The
  // chunks are stored and the document is still readable; only retrieval is unavailable,
  // and it starts working as soon as the webhook URL is set - no re-upload needed.
  if (!process.env.N8N_EMBED_WEBHOOK_URL) {
    return {
      chunkCount: rows.length,
      embeddedCount: 0,
      skipped: "search is not configured yet, so this is stored but not searchable",
    };
  }

  const byIndex = new Map(rows.map((r) => [r.chunk_index, r.id]));

  const response = await requestEmbedding({
    documentId,
    projectId,
    userId,
    namespace: namespaceFor(userId, projectId),
    chunks: pieces.map((p) => ({
      id: byIndex.get(p.index)!,
      index: p.index,
      content: p.content,
    })),
  });

  const embedded = response.embedded ?? [];
  if (embedded.length > 0) {
    await supabase
      .from("chunks")
      .update({ embedded: true, embedded_at: new Date().toISOString() })
      .in("id", embedded)
      .eq("user_id", userId);
  }

  if (response.failed?.length) {
    console.error("[indexDocument] some chunks were not indexed", {
      documentId,
      failed: response.failed.length,
      firstError: response.failed[0]?.error,
    });
  }

  return { chunkCount: rows.length, embeddedCount: embedded.length };
}
