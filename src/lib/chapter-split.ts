import "server-only";

/**
 * Detects chapter boundaries in already-extracted text and, if confident, splits it.
 *
 * Most students have one file covering their whole project, not five separate ones. This
 * lets that work: when nothing was picked in the Chapter dropdown, the upload action calls
 * this on the extracted text, and a confident split turns one upload into several correctly
 * tagged per-chapter documents - the same shape the app already produces from five separate
 * uploads, just reached a different way.
 *
 * The hard part is a table of contents. It lists every chapter heading before the real one
 * appears, often with formatting a dot-leader filter alone will not catch (tab-aligned page
 * numbers, a page number on its own line, no page number at all). Filtering TOC-shaped lines
 * out by guessing their format failed against a real thesis in testing - three chapters came
 * back as slivers of a few dozen words, because the TOC's cluster of headings was mistaken
 * for the real ones, and the fourth absorbed almost the entire rest of the document because
 * a fifth heading was never found to bound it.
 *
 * The fix does not try to recognise a table of contents at all. Instead, for each chapter
 * number, of every place that heading appears in the document, this takes the *last* one -
 * anchored backward from the highest chapter number found, each earlier chapter constrained
 * to the last occurrence strictly before the next chapter's chosen position. A table of
 * contents is, structurally, a cluster of *early* occurrences; the real section start for
 * chapter N is reliably the last time "chapter N" appears before chapter N+1 begins,
 * regardless of what the table of contents looked like or how many times a running header
 * might repeat a heading. As a second, independent safety net, any resulting segment under
 * roughly a page of text is treated as proof this still went wrong - a table of contents
 * entry produces a sliver, a real chapter does not - and the whole split is abandoned rather
 * than committed as a bad guess.
 *
 * A single stray mention of "Chapter One" in running prose is also not evidence of a
 * multi-chapter upload, so at least two headings, strictly ascending, are required before
 * this commits to anything. Short of that, or if the length check fails, this returns null
 * and the caller treats the upload as one ordinary document - exactly what happened before
 * this existed.
 */

export type ChapterSplit = {
  chapter: number;
  heading: string;
  text: string;
};

const CHAPTER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
};

const HEADING = /^chapter\s+(one|two|three|four|five|[1-5])\b\s*[:.\-–]?\s*(.*)$/i;

// A real chapter of a final-year project runs to many pages. Anything shorter than this
// once split is treated as evidence of a bad boundary, not a short chapter.
const MIN_CHAPTER_WORDS = 120;

export function splitByChapter(text: string): ChapterSplit[] | null {
  const lines = text.split("\n");

  // Every occurrence of every chapter heading, in document order - a table of contents
  // entry and the real section start for the same chapter both land here; picking the
  // right one happens below.
  const occurrences = new Map<number, number[]>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = HEADING.exec(line);
    if (!match) continue;

    const chapter = CHAPTER_WORDS[match[1].toLowerCase()];
    if (chapter === undefined) continue;

    const list = occurrences.get(chapter) ?? [];
    list.push(i);
    occurrences.set(chapter, list);
  }

  const numbers = [...occurrences.keys()].sort((a, b) => a - b);
  if (numbers.length < 2) return null;

  // Anchor at the highest chapter found: its last occurrence in the document is its real
  // section start, since nothing comes after it to confuse the choice.
  const chosen = new Map<number, number>();
  chosen.set(numbers[numbers.length - 1], last(occurrences.get(numbers[numbers.length - 1])!));

  for (let i = numbers.length - 2; i >= 0; i--) {
    const n = numbers[i];
    const bound = chosen.get(numbers[i + 1])!;
    const candidates = occurrences.get(n)!.filter((pos) => pos < bound);
    // No occurrence of this chapter before the next one's chosen position at all means the
    // detected order does not actually hold up - abandon rather than guess.
    if (candidates.length === 0) return null;
    chosen.set(n, last(candidates));
  }

  const ordered = numbers.map((n) => ({ chapter: n, lineIndex: chosen.get(n)! }));

  // Character offset of the start of each line, so slices come from the original text
  // rather than a re-joined copy that would lose its exact spacing.
  const lineStart: number[] = [0];
  for (const line of lines) lineStart.push(lineStart[lineStart.length - 1] + line.length + 1);

  const segments = ordered.map((f, i) => {
    const start = lineStart[f.lineIndex];
    const end = i + 1 < ordered.length ? lineStart[ordered[i + 1].lineIndex] : text.length;
    return {
      chapter: f.chapter,
      heading: lines[f.lineIndex].trim(),
      text: text.slice(start, end).trim(),
    };
  });

  if (segments.some((s) => wordCount(s.text) < MIN_CHAPTER_WORDS)) return null;

  return segments;
}

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
