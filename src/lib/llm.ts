import "server-only";

/**
 * Answer shaping.
 *
 * Generation itself runs in n8n (see `n8n/answer-workflow.json`), so the prompt lives on
 * the canvas where it can be reworded without a redeploy. This module keeps only the parts
 * that must stay in code: the shape of an excerpt, and turning the model's `[n]` citations
 * back into real chunk ids.
 *
 * The prompt is deliberately *not* duplicated here. Two copies of a prompt drift, and a
 * drifted copy is worse than none — the citations would stop lining up with what the model
 * was actually shown.
 */

export type SourceChunk = {
  id: string;
  chapter: number | null;
  label: string | null;
  content: string;
};

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Maps the `[n]` citations the model emits back to real chunk ids.
 *
 * Position is the whole contract: n8n numbers the excerpts in the order it receives them,
 * so `[1]` is the first chunk this app sent. Anything out of range is dropped rather than
 * guessed at — a wrong citation would point the student at a section that does not support
 * the claim, which is worse than showing no source at all.
 */
export function citedChunkIds(answer: string, chunks: SourceChunk[]): string[] {
  const ids = new Set<string>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const chunk = chunks[Number(m[1]) - 1];
    if (chunk) ids.add(chunk.id);
  }
  return [...ids];
}
