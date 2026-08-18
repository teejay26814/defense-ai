import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Recording what the AI costs.
 *
 * CLAUDE.md requires usage tracked per user and project, because this is multi-user SaaS
 * and model spend has to stay controllable. The rule this module follows is that logging
 * must never be able to break the thing it is measuring: every write is best-effort, and a
 * failure here is logged to the server console and swallowed. A student losing their
 * generated questions because the usage insert failed would be an absurd trade.
 *
 * Failures are recorded too. A generation that times out after sending forty chunks has
 * already cost real money, so a table holding only successes would understate the bill
 * precisely when something is wrong.
 */

export type AiOperation = "answer" | "questions" | "mnemonics" | "embed";

export type UsageRecord = {
  userId: string;
  projectId?: string | null;
  operation: AiOperation;
  model?: string | null;
  /** Null wherever the provider path does not report them. See the migration's note. */
  promptTokens?: number | null;
  completionTokens?: number | null;
  chunksSent?: number | null;
  itemsReturned?: number | null;
  durationMs?: number | null;
  succeeded: boolean;
  error?: string | null;
};

export async function recordUsage(
  supabase: SupabaseClient,
  record: UsageRecord,
): Promise<void> {
  try {
    const { error } = await supabase.from("ai_usage").insert({
      user_id: record.userId,
      project_id: record.projectId ?? null,
      operation: record.operation,
      model: record.model ?? null,
      prompt_tokens: record.promptTokens ?? null,
      completion_tokens: record.completionTokens ?? null,
      chunks_sent: record.chunksSent ?? null,
      items_returned: record.itemsReturned ?? null,
      duration_ms: record.durationMs ?? null,
      succeeded: record.succeeded,
      // Truncated: an error string can carry a stack or a provider payload, and this
      // column exists to make a pattern visible, not to be a log sink.
      error: record.error ? record.error.slice(0, 500) : null,
    });

    if (error) console.error("[recordUsage] insert failed", error);
  } catch (err) {
    console.error("[recordUsage] threw", err);
  }
}

/**
 * Times an AI call and records it either way.
 *
 * Wrapping rather than asking each caller to log twice: the failure path is the one that
 * gets forgotten, and it is the one that matters most for cost.
 */
export async function withUsage<T>(
  supabase: SupabaseClient,
  record: Omit<UsageRecord, "succeeded" | "durationMs" | "itemsReturned">,
  run: () => Promise<T>,
  countItems?: (result: T) => number,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    await recordUsage(supabase, {
      ...record,
      succeeded: true,
      durationMs: Date.now() - started,
      itemsReturned: countItems ? countItems(result) : null,
    });
    return result;
  } catch (err) {
    await recordUsage(supabase, {
      ...record,
      succeeded: false,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
