import "server-only";

import { createHmac } from "node:crypto";

import type { DefenseScope } from "@/lib/types";

/**
 * Talking to n8n.
 *
 * n8n orchestrates embedding and retrieval; it is never the database (CLAUDE.md). It
 * receives chunk text to embed and returns which chunk ids succeeded - it holds no
 * Supabase credential and stores no student text of its own.
 *
 * Both calls are request/response rather than fire-and-callback, which is the deciding
 * design choice here: the server action that calls n8n still has the student's session,
 * so it writes the results itself under RLS. A callback would arrive with no session and
 * would need the service-role key plus a public, signed endpoint - a whole attack surface
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

/** n8n returns ids and scores only - never text. The text is hydrated from Supabase. */
export type QueryResponse = {
  matches: { chunkId: string; score: number }[];
};

/**
 * Answer generation.
 *
 * Unlike the two calls above, this one deliberately sends chunk *text* to n8n - it has to,
 * because the model needs the excerpts. That is safe only because of when it happens: the
 * caller has already hydrated these chunks out of Postgres under the student's own
 * session, so RLS has decided what is in here before it leaves the app. n8n is handed a
 * finished, already-authorised excerpt list and must not look anything else up.
 *
 * Excerpt order is part of the contract. n8n numbers the excerpts as it receives them and
 * the model cites them by number, so the caller maps `[n]` back to a chunk id by position.
 */
export type AnswerRequest = {
  projectId: string;
  userId: string;
  question: string;
  chunks: { id: string; chapter: number | null; label: string | null; content: string }[];
};

export type AnswerResponse = { answer: string };

/**
 * Question generation.
 *
 * Same rule as answers: the caller has already hydrated these chunks under the student's
 * own session, so RLS decided what is in the payload before it left the app.
 *
 * Unlike retrieval, this is not a similarity search. Questions should cover the project
 * rather than cluster around one topic, so the caller passes a spread of chunks read
 * straight from Postgres and Pinecone is not involved at all.
 */
export type QuestionsRequest = {
  projectId: string;
  userId: string;
  /** Which occasion the student is preparing for. Changes what the examiner asks. */
  scope: DefenseScope;
  count: number;
  chunks: { id: string; chapter: number | null; label: string | null; content: string }[];
};

export type QuestionsResponse = {
  questions: {
    question: string;
    answer: string;
    difficulty: number;
    /** 0-based positions into the chunks that were sent, so the caller can map to ids. */
    sourceIndexes: number[];
  }[];
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
        // built-in Header Auth. The HMAC headers below are stronger - they also cover
        // replay and body tampering - but verifying them needs `crypto` inside a Code
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

    // A workflow that throws before reaching its "Respond to Webhook" node answers 200
    // with an empty body rather than an error status. Parsing that would surface as
    // "Unexpected end of JSON input", which says nothing useful - so name it here, and
    // point at the execution log, which is where the actual reason lives.
    const text = await res.text();
    if (!text.trim()) {
      throw new Error(
        "n8n returned an empty response, which means the workflow failed before it could " +
          "reply. Check the workflow's execution log for the failing node.",
      );
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`n8n returned a non-JSON response: ${text.slice(0, 300)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The vector-index namespace for one project.
 *
 * Both ids are included so a namespace cannot be guessed from a project id alone. This is
 * defence in depth, not the security boundary - retrieval hydrates text from Supabase
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

/**
 * Generous timeout: a long answer on a cold workflow can take a while, and the student is
 * watching a spinner until it lands - a premature abort costs them the whole question.
 */
export async function requestAnswer(payload: AnswerRequest): Promise<AnswerResponse> {
  const url = process.env.N8N_ANSWER_WEBHOOK_URL;
  if (!url) throw new Error("N8N_ANSWER_WEBHOOK_URL is not set.");
  return post<AnswerResponse>(url, payload, 120_000);
}

/**
 * The longest timeout of the three: this writes a dozen questions over a wide span of the
 * project, so it is a much larger generation than a single answer. It is also the one call
 * a student is not sitting and watching, having been told it takes a moment.
 */
export async function requestQuestions(
  payload: QuestionsRequest,
): Promise<QuestionsResponse> {
  const url = process.env.N8N_QUESTIONS_WEBHOOK_URL;
  if (!url) throw new Error("N8N_QUESTIONS_WEBHOOK_URL is not set.");
  return post<QuestionsResponse>(url, payload, 180_000);
}
