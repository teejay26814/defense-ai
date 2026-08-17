import "server-only";

/**
 * Answer generation.
 *
 * Deliberately a thin fetch against an OpenAI-compatible chat-completions endpoint rather
 * than a vendor SDK, per CLAUDE.md: the provider stays replaceable. OpenRouter is the
 * default, and moving to a direct provider later is a base URL and a model id, not a
 * rewrite.
 *
 * This runs in the app, not in n8n, and that placement is load-bearing. The prompt is
 * built from chunks already hydrated out of Postgres under the student's own session, so
 * Row Level Security decides what can reach the model. n8n only ever handles chunk ids.
 */

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "anthropic/claude-opus-4.1";

export type SourceChunk = {
  id: string;
  chapter: number | null;
  label: string | null;
  content: string;
};

export type GroundedAnswer = {
  answer: string;
  /** Chunk ids the model reported using, so the UI can show which chapters it drew on. */
  usedChunkIds: string[];
  model: string;
  usage: { promptTokens: number | null; completionTokens: number | null };
};

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

function config() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new LlmError(
      "OPENROUTER_API_KEY is not set. Add it to .env.local — get one at " +
        "https://openrouter.ai/keys — and restart the dev server.",
    );
  }
  return {
    apiKey,
    baseUrl: process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
  };
}

/**
 * The system prompt.
 *
 * The product rule from CLAUDE.md is that answers are grounded in the student's own
 * project and cite the chapter they came from. So the model is told to work only from the
 * excerpts, and — importantly — to say when the project does not answer the question.
 * A confident answer invented from general knowledge is worse than useless here: the
 * student would walk into their defense believing their project says something it does
 * not.
 */
const SYSTEM_PROMPT = `You are a defense coach for a final-year university student. You are helping them understand and defend their own project.

You will be given numbered excerpts from the student's project, followed by their question.

Rules:
- Answer only from the excerpts. They are the student's own work and are the sole source of truth.
- If the excerpts do not contain the answer, say so plainly and name what is missing. Never fill a gap with general knowledge — the student would carry that into their defense believing it was in their project.
- Cite the excerpts you used by their number, like [1] or [2][4], placed where the claim is made.
- Write the way a supervisor would speak: direct, specific, and in the student's own terminology rather than generic academic phrasing.
- Be concise. Answer what was asked, then stop.`;

function buildUserMessage(chunks: SourceChunk[], question: string): string {
  const excerpts = chunks
    .map((c, i) => {
      const where = c.chapter
        ? `Chapter ${c.chapter}${c.label ? ` — ${c.label}` : ""}`
        : (c.label ?? "Unlabelled section");
      return `[${i + 1}] (${where})\n${c.content}`;
    })
    .join("\n\n---\n\n");

  return `Excerpts from the project:\n\n${excerpts}\n\n---\n\nStudent's question: ${question}`;
}

/** Maps the [n] citations the model emits back to real chunk ids. */
function citedChunkIds(answer: string, chunks: SourceChunk[]): string[] {
  const ids = new Set<string>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const chunk = chunks[Number(m[1]) - 1];
    if (chunk) ids.add(chunk.id);
  }
  return [...ids];
}

export async function answerFromChunks(
  chunks: SourceChunk[],
  question: string,
): Promise<GroundedAnswer> {
  if (chunks.length === 0) {
    throw new LlmError(
      "Nothing from your project matched that question. Upload the relevant chapter, or try rewording it.",
    );
  }

  const { apiKey, baseUrl, model } = config();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // OpenRouter attributes traffic with these; harmless on other providers.
        "http-referer": "https://academiascribes.app",
        "x-title": "Academia Scribes Defense Coach",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(chunks, question) },
        ],
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new LlmError("That took too long. Please try again.");
    }
    throw new LlmError("Could not reach the AI provider. Please try again.");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error("[llm] provider error", res.status, detail);
    // Provider errors are logged in full but never surfaced — they can carry key
    // fragments, model routing details, and account information.
    throw new LlmError(
      res.status === 429
        ? "The AI provider is rate limiting us. Wait a moment and try again."
        : "The answer could not be generated. Please try again.",
    );
  }

  const data = await res.json();
  const answer: string | undefined = data?.choices?.[0]?.message?.content;

  if (!answer?.trim()) {
    throw new LlmError("The AI returned an empty answer. Please try again.");
  }

  return {
    answer: answer.trim(),
    usedChunkIds: citedChunkIds(answer, chunks),
    model: data?.model ?? model,
    usage: {
      promptTokens: data?.usage?.prompt_tokens ?? null,
      completionTokens: data?.usage?.completion_tokens ?? null,
    },
  };
}
