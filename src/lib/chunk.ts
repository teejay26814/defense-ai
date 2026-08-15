import "server-only";

/**
 * Splits an extracted document into retrievable pieces.
 *
 * Chunking happens here rather than in n8n on purpose: the student's session is available
 * at upload time, so the rows can be written under RLS. If n8n wrote them it would need
 * the service-role key, which bypasses RLS entirely — see CLAUDE.md. n8n then only
 * embeds the text it is handed and upserts vectors; it never holds a Supabase credential.
 *
 * The splitter is paragraph-aware. Academic writing carries a lot of meaning in its
 * paragraph and section structure, and cutting mid-sentence produces chunks that retrieve
 * badly and cite worse.
 */

export type Chunk = {
  index: number;
  content: string;
  tokenCount: number;
};

/** Target chunk size, in tokens. */
const TARGET_TOKENS = 700;

/**
 * Overlap between neighbours. A claim that straddles a boundary would otherwise be
 * retrievable from neither side, so the tail of each chunk repeats at the head of the
 * next.
 */
const OVERLAP_TOKENS = 100;

const MIN_TOKENS = 40;

/**
 * Rough token estimate: ~4 characters per token for English prose.
 *
 * Deliberately an approximation. An exact count would mean shipping a tokenizer for
 * whichever embedding model is in use, and the number is only used to size chunks — being
 * 10% out changes nothing about retrieval quality.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitOversizedParagraph(paragraph: string, limitChars: number): string[] {
  // Fall back to sentence boundaries, then to a hard character cut for a paragraph with
  // no sentence breaks at all (a long table or reference list, typically).
  const sentences = paragraph.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) ?? [paragraph];
  const out: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > limitChars) {
      if (current) {
        out.push(current.trim());
        current = "";
      }
      for (let i = 0; i < sentence.length; i += limitChars) {
        out.push(sentence.slice(i, i + limitChars).trim());
      }
      continue;
    }
    if (current.length + sentence.length > limitChars && current) {
      out.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

export function chunkText(text: string): Chunk[] {
  const limitChars = TARGET_TOKENS * 4;
  const overlapChars = OVERLAP_TOKENS * 4;

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Pack whole paragraphs up to the limit; split only those that exceed it alone.
  const pieces: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > limitChars) {
      if (buffer) {
        pieces.push(buffer);
        buffer = "";
      }
      pieces.push(...splitOversizedParagraph(paragraph, limitChars));
      continue;
    }

    if (buffer && buffer.length + paragraph.length + 2 > limitChars) {
      pieces.push(buffer);
      buffer = paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }
  if (buffer) pieces.push(buffer);

  // Add the trailing overlap, then drop fragments too small to retrieve usefully.
  const chunks: Chunk[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const previous = i > 0 ? pieces[i - 1] : "";
    const overlap = previous ? previous.slice(-overlapChars) : "";
    const content = (overlap ? `${overlap}\n\n${pieces[i]}` : pieces[i]).trim();

    if (estimateTokens(content) < MIN_TOKENS && chunks.length > 0) {
      // Too small to stand alone — fold it into the previous chunk instead.
      const last = chunks[chunks.length - 1];
      last.content = `${last.content}\n\n${pieces[i]}`.trim();
      last.tokenCount = estimateTokens(last.content);
      continue;
    }

    chunks.push({
      index: chunks.length,
      content,
      tokenCount: estimateTokens(content),
    });
  }

  return chunks;
}
