import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

import { signInternal, verifyInternal } from "../../src/lib/internal-signing";

/**
 * The slow half of question generation, moved out of the request the student's browser is
 * waiting on.
 *
 * `generateQuestions` (the server action) does everything that has to run under the
 * student's session - auth, the plan-limit check, reading their chunks under RLS - then
 * hands off here with a `generation_jobs` row already created. Netlify treats this file as
 * a Background Function because of `config.background` below: it answers the caller with
 * 202 in milliseconds and then keeps running for up to 15 minutes, which a synchronous
 * function (and every server action) cannot do - Netlify kills those at 10 seconds, and a
 * real question set takes 30-90.
 *
 * This is a plain Node script outside the Next.js bundle, not a route Next.js instruments,
 * so it cannot import anything that carries the `server-only` guard (`src/lib/n8n.ts`,
 * `src/lib/usage.ts`) - those throw the moment something outside Next's own server-only
 * bundling condition imports them. Everything this needs is reimplemented here instead,
 * against the service-role client, the same way the Paystack webhook route already does
 * for the one other place in this app that runs with no student session behind it.
 */

type ChunkPayload = { id: string; chapter: number | null; label: string | null; content: string };

type JobPayload = {
  jobId: string;
  projectId: string;
  userId: string;
  scope: "chapter" | "proposal" | "final";
  count: number;
  chunks: ChunkPayload[];
};

type QuestionsResponse = {
  questions: {
    question: string;
    answer: string;
    difficulty: number;
    sourceIndexes: number[];
    options: string[] | null;
    correct: number | null;
  }[];
};

const SIGNATURE_HEADER = "x-academia-signature";
const TIMESTAMP_HEADER = "x-academia-timestamp";

const handler = async (request: Request): Promise<Response> => {
  const raw = await request.text();

  const internalSecret = process.env.INTERNAL_JOB_SECRET;
  if (!internalSecret) {
    console.error("[generate-questions] INTERNAL_JOB_SECRET is not set");
    return new Response("not configured", { status: 500 });
  }

  const signature = request.headers.get(SIGNATURE_HEADER);
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  if (
    !signature ||
    !timestamp ||
    !verifyInternal(internalSecret, timestamp, raw, signature)
  ) {
    console.error("[generate-questions] bad or missing signature");
    return new Response("unauthorized", { status: 401 });
  }

  const payload = JSON.parse(raw) as JobPayload;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[generate-questions] Supabase service role not configured");
    return new Response("not configured", { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const started = Date.now();

  try {
    const generated = await requestQuestionsFromN8n(payload);

    if (!generated?.length) {
      throw new Error("No questions came back from n8n.");
    }

    const toInsert = generated.map((q) => {
      const sources = q.sourceIndexes
        .map((i) => payload.chunks[i])
        .filter((c): c is ChunkPayload => Boolean(c));

      const chapterSet = new Set(sources.map((c) => c.chapter));

      return {
        project_id: payload.projectId,
        user_id: payload.userId,
        chapter: chapterSet.size === 1 ? [...chapterSet][0] : null,
        question: q.question,
        model_answer: q.answer,
        source_chunk_ids: sources.map((c) => c.id),
        difficulty: q.difficulty,
        options: q.options && q.correct !== null ? q.options : null,
        correct_option: q.options && q.correct !== null ? q.correct : null,
      };
    });

    const { error: insertError } = await admin.from("questions").insert(toInsert);
    if (insertError) throw new Error(`Could not save questions: ${insertError.message}`);

    await admin.from("generation_jobs").update({
      status: "succeeded",
      result_count: toInsert.length,
    }).eq("id", payload.jobId);

    await admin.from("ai_usage").insert({
      user_id: payload.userId,
      project_id: payload.projectId,
      operation: "questions",
      chunks_sent: payload.chunks.length,
      items_returned: toInsert.length,
      duration_ms: Date.now() - started,
      succeeded: true,
    });

    return new Response(null, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-questions] failed", message);

    await admin.from("generation_jobs").update({
      status: "failed",
      error: message.slice(0, 500),
    }).eq("id", payload.jobId);

    await admin.from("ai_usage").insert({
      user_id: payload.userId,
      project_id: payload.projectId,
      operation: "questions",
      chunks_sent: payload.chunks.length,
      duration_ms: Date.now() - started,
      succeeded: false,
      error: message.slice(0, 500),
    });

    return new Response(null, { status: 202 });
  }
};

export default handler;

async function requestQuestionsFromN8n(payload: JobPayload): Promise<QuestionsResponse["questions"]> {
  const url = process.env.N8N_QUESTIONS_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url) throw new Error("N8N_QUESTIONS_WEBHOOK_URL is not set.");
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not set.");

  const body = JSON.stringify({
    projectId: payload.projectId,
    userId: payload.userId,
    scope: payload.scope,
    count: payload.count,
    chunks: payload.chunks,
  });
  const timestamp = String(Date.now());

  // Generous but not unbounded: a background function gets up to 15 minutes total, but a
  // workflow that is still not answering after 3 is stuck, not merely slow.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        [SIGNATURE_HEADER]: signInternal(secret, timestamp, body),
        [TIMESTAMP_HEADER]: timestamp,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`n8n responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const text = await res.text();
    if (!text.trim()) {
      throw new Error(
        "n8n returned an empty response, which means the workflow failed before it could " +
          "reply. Check the workflow's execution log for the failing node.",
      );
    }

    let parsed: QuestionsResponse;
    try {
      parsed = JSON.parse(text) as QuestionsResponse;
    } catch {
      throw new Error(`n8n returned a non-JSON response: ${text.slice(0, 300)}`);
    }

    return parsed.questions;
  } finally {
    clearTimeout(timer);
  }
}

export const config: Config = {
  background: true,
};
