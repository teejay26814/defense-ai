import "server-only";

import { createHmac } from "node:crypto";

/**
 * Talking to n8n.
 *
 * n8n orchestrates embedding and retrieval; it is never the database (CLAUDE.md). It
 * receives chunk text to embed and returns which chunk ids succeeded — it holds no
 * Supabase credential and stores no student text of its own.
 *
 * Both calls are request/response rather than fire-and-callback, which is the deciding
 * design choice here: the server action that calls n8n still has the student's session,
 * so it writes the results itself under RLS. A callback would arrive with no session and
 * would need the service-role key plus a public, signed endpoint — a whole attack surface
 * that simply does not exist this way. In n8n terms, each workflow ends in a
 * "Respond to Webhook" node.
 *
 * Outbound requests are still signed, so n8n can reject anything that did not come from
 * this app.
 */

export type EmbedRequest = {
  documentId: string;
  projectId: string;
  userId: string;
  namespace: string;
  chunks: { id: string; index: number; content: string }[];
};

/** n8n reports which chunks made it into the index; the caller flips those rows. */
export type EmbedResponse = {
  embedded: string[];
  failed?: { chunkId: string; error: string }[];
};

export type QueryRequest = {
  projectId: string;
  userId: string;
  namespace: string;
  question: string;
  topK: number;
};

/** n8n returns ids and scores only — never text. The text is hydrated from Supabase. */
export type QueryResponse = {
  matches: { chunkId: string; score: number }[];
};

const SIGNATURE_HEADER = "x-academia-signature";
const TIMESTAMP_HEADER = "x-academia-timestamp";

function secret(): string {
  const value = process.env.N8N_WEBHOOK_SECRET;
  if (!value) {
    throw new Error(
      "N8N_WEBHOOK_SECRET is not set. Generate one with `openssl rand -hex 32` and put " +
        "the same value in .env.local and in the n8n workflow's credentials.",
    );
  }
  return value;
}

export function sign(timestamp: string, body: string): string {
  return createHmac("sha256", secret()).update(`${timestamp}.${body}`).digest("hex");
}

async function post<T>(url: string, payload: unknown, timeoutMs: number): Promise<T> {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());

  // n8n workflows can be slow to cold-start; without a timeout a hung workflow would hold
  // a server action open until the platform kills it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Bearer token so the n8n Webhook node can authenticate natively with its
        // built-in Header Auth. The HMAC headers below are stronger — they also cover
        // replay and body tampering — but verifying them needs `crypto` inside a Code
        // node, which self-hosted n8n only exposes when NODE_FUNCTION_ALLOW_BUILTIN is
        // set. Both are sent, so the workflow can start on Header Auth and tighten later.
        authorization: `Bearer ${secret()}`,
        [SIGNATURE_HEADER]: sign(timestamp, body),
        [TIMESTAMP_HEADER]: timestamp,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`n8n responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The vector-index namespace for one project.
 *
 * Both ids are included so a namespace cannot be guessed from a project id alone. This is
 * defence in depth, not the security boundary — retrieval hydrates text from Supabase
 * under the student's session, so RLS remains what actually separates students.
 */
export function namespaceFor(userId: string, projectId: string): string {
  return `u_${userId}__p_${projectId}`;
}

export async function requestEmbedding(payload: EmbedRequest): Promise<EmbedResponse> {
  const url = process.env.N8N_EMBED_WEBHOOK_URL;
  if (!url) throw new Error("N8N_EMBED_WEBHOOK_URL is not set.");
  return post<EmbedResponse>(url, payload, 120_000);
}

export async function requestRetrieval(payload: QueryRequest): Promise<QueryResponse> {
  const url = process.env.N8N_QUERY_WEBHOOK_URL;
  if (!url) throw new Error("N8N_QUERY_WEBHOOK_URL is not set.");
  return post<QueryResponse>(url, payload, 60_000);
}
