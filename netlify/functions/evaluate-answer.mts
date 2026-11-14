import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

import { signInternal, verifyInternal } from "../../src/lib/internal-signing";

/**
 * The slow half of marking one mock defense answer, moved out of the request the student's
 * browser is waiting on - same reasoning as generate-questions.mts. This is the call that
 * was actually reported broken: checking ai_usage after a live failure showed no row at
 * all, the same signature as the original questions bug - the process that would have
 * logged the failure was the one Netlify killed at 10 seconds.
 */

type JobPayload = {
  jobId: string;
  sessionId: string;
  projectId: string;
  userId: string;
  questionId: string;
  question: string;
  answer: string;
  modelAnswer: string;
};

type EvaluateResponse = {
  score: number;
  covered: string[];
  missed: string[];
  feedback: string;
};

const SIGNATURE_HEADER = "x-academia-signature";
const TIMESTAMP_HEADER = "x-academia-timestamp";

const handler = async (request: Request): Promise<Response> => {
  const raw = await request.text();

  const internalSecret = process.env.INTERNAL_JOB_SECRET;
  if (!internalSecret) {
    console.error("[evaluate-answer] INTERNAL_JOB_SECRET is not set");
    return new Response("not configured", { status: 500 });
  }

  const signature = request.headers.get(SIGNATURE_HEADER);
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  if (
    !signature ||
    !timestamp ||
    !verifyInternal(internalSecret, timestamp, raw, signature)
  ) {
    console.error("[evaluate-answer] bad or missing signature");
    return new Response("unauthorized", { status: 401 });
  }

  const payload = JSON.parse(raw) as JobPayload;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[evaluate-answer] Supabase service role not configured");
    return new Response("not configured", { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const started = Date.now();

  try {
    const mark = await requestEvaluationFromN8n(payload);

    const { error: insertError } = await admin.from("defense_answers").insert({
      session_id: payload.sessionId,
      project_id: payload.projectId,
      user_id: payload.userId,
      question_id: payload.questionId,
      question: payload.question,
      answer: payload.answer,
      model_answer: payload.modelAnswer,
      score: mark.score,
      covered: mark.covered,
      missed: mark.missed,
      feedback: mark.feedback,
    });
    if (insertError) throw new Error(`Could not save the marked answer: ${insertError.message}`);

    await admin.from("generation_jobs").update({
      status: "succeeded",
      result_count: 1,
    }).eq("id", payload.jobId);

    // Recorded as "evaluate", its own operation. It used to be logged as "answer", which
    // made every marked answer use up one of the student's Ask allowance. Marking is
    // bounded by sittings x sitting length instead (plans.ts).
    await admin.from("ai_usage").insert({
      user_id: payload.userId,
      project_id: payload.projectId,
      operation: "evaluate",
      chunks_sent: 1,
      items_returned: 1,
      duration_ms: Date.now() - started,
      succeeded: true,
    });

    return new Response(null, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[evaluate-answer] failed", message);

    await admin.from("generation_jobs").update({
      status: "failed",
      error: message.slice(0, 500),
    }).eq("id", payload.jobId);

    await admin.from("ai_usage").insert({
      user_id: payload.userId,
      project_id: payload.projectId,
      operation: "evaluate",
      chunks_sent: 1,
      duration_ms: Date.now() - started,
      succeeded: false,
      error: message.slice(0, 500),
    });

    return new Response(null, { status: 202 });
  }
};

async function requestEvaluationFromN8n(payload: JobPayload): Promise<EvaluateResponse> {
  const url = process.env.N8N_EVALUATE_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url) throw new Error("N8N_EVALUATE_WEBHOOK_URL is not set.");
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not set.");

  // No chunks, no project id in the body - the examiner sees only this question and this
  // answer, the same restriction the old synchronous call made (see defense/actions.ts).
  const body = JSON.stringify({
    projectId: payload.projectId,
    userId: payload.userId,
    question: payload.question,
    answer: payload.answer,
    modelAnswer: payload.modelAnswer,
  });
  const timestamp = String(Date.now());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150_000);

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

    try {
      return JSON.parse(text) as EvaluateResponse;
    } catch {
      throw new Error(`n8n returned a non-JSON response: ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export default handler;

export const config: Config = {
  background: true,
};
