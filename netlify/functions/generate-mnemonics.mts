import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

import { signInternal, verifyInternal } from "../../src/lib/internal-signing";

/**
 * The slow half of memory-aid generation, moved out of the request the student's browser
 * is waiting on - same reasoning as netlify/functions/generate-questions.mts. Its one real
 * historical sample ran 8.8 seconds, close enough to Netlify's 10-second synchronous limit
 * that it is the same bug waiting to happen, not a different one.
 */

type ChunkPayload = { id: string; chapter: number | null; label: string | null; content: string };

type JobPayload = {
  jobId: string;
  projectId: string;
  userId: string;
  chunks: ChunkPayload[];
};

type MnemonicsResponse = {
  mnemonics: {
    title: string;
    items: string[];
    aid: string;
    explanation: string | null;
    sourceIndexes: number[];
  }[];
};

const SIGNATURE_HEADER = "x-academia-signature";
const TIMESTAMP_HEADER = "x-academia-timestamp";

const handler = async (request: Request): Promise<Response> => {
  const raw = await request.text();

  const internalSecret = process.env.INTERNAL_JOB_SECRET;
  if (!internalSecret) {
    console.error("[generate-mnemonics] INTERNAL_JOB_SECRET is not set");
    return new Response("not configured", { status: 500 });
  }

  const signature = request.headers.get(SIGNATURE_HEADER);
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  if (
    !signature ||
    !timestamp ||
    !verifyInternal(internalSecret, timestamp, raw, signature)
  ) {
    console.error("[generate-mnemonics] bad or missing signature");
    return new Response("unauthorized", { status: 401 });
  }

  const payload = JSON.parse(raw) as JobPayload;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[generate-mnemonics] Supabase service role not configured");
    return new Response("not configured", { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const started = Date.now();

  try {
    const generated = await requestMnemonicsFromN8n(payload);

    if (!generated?.length) {
      throw new Error(
        "No clear lists were found in your chapters yet. Memory aids work best on " +
          "numbered objectives, research questions, or limitations.",
      );
    }

    const toInsert = generated.map((m) => {
      const sources = m.sourceIndexes
        .map((i) => payload.chunks[i])
        .filter((c): c is ChunkPayload => Boolean(c));
      const chapters = new Set(sources.map((c) => c.chapter));

      return {
        project_id: payload.projectId,
        user_id: payload.userId,
        chapter: chapters.size === 1 ? [...chapters][0] : null,
        title: m.title,
        items: m.items,
        aid: m.aid,
        explanation: m.explanation,
      };
    });

    // Replaces rather than appends, same as the old synchronous path: only once a new set
    // has actually come back, never on a failure that would otherwise wipe out a working
    // set for nothing.
    await admin.from("mnemonics").delete().eq("project_id", payload.projectId);

    const { error: insertError } = await admin.from("mnemonics").insert(toInsert);
    if (insertError) throw new Error(`Could not save memory aids: ${insertError.message}`);

    await admin.from("generation_jobs").update({
      status: "succeeded",
      result_count: toInsert.length,
    }).eq("id", payload.jobId);

    await admin.from("ai_usage").insert({
      user_id: payload.userId,
      project_id: payload.projectId,
      operation: "mnemonics",
      chunks_sent: payload.chunks.length,
      items_returned: toInsert.length,
      duration_ms: Date.now() - started,
      succeeded: true,
    });

    return new Response(null, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-mnemonics] failed", message);

    await admin.from("generation_jobs").update({
      status: "failed",
      error: message.slice(0, 500),
    }).eq("id", payload.jobId);

    await admin.from("ai_usage").insert({
      user_id: payload.userId,
      project_id: payload.projectId,
      operation: "mnemonics",
      chunks_sent: payload.chunks.length,
      duration_ms: Date.now() - started,
      succeeded: false,
      error: message.slice(0, 500),
    });

    return new Response(null, { status: 202 });
  }
};

async function requestMnemonicsFromN8n(payload: JobPayload): Promise<MnemonicsResponse["mnemonics"]> {
  const url = process.env.N8N_MNEMONICS_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!url) throw new Error("N8N_MNEMONICS_WEBHOOK_URL is not set.");
  if (!secret) throw new Error("N8N_WEBHOOK_SECRET is not set.");

  const body = JSON.stringify({
    projectId: payload.projectId,
    userId: payload.userId,
    chunks: payload.chunks,
  });
  const timestamp = String(Date.now());

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

    let parsed: MnemonicsResponse;
    try {
      parsed = JSON.parse(text) as MnemonicsResponse;
    } catch {
      throw new Error(`n8n returned a non-JSON response: ${text.slice(0, 300)}`);
    }

    return parsed.mnemonics;
  } finally {
    clearTimeout(timer);
  }
}

export default handler;

export const config: Config = {
  background: true,
};
