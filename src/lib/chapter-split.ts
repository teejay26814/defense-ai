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
 *
 * Two more extraction quirks showed up once this ran against a real chapter five that a
 * strict same-line match still missed, even with the TOC fix in place:
 *
 * - A running header or page number sharing the line with the heading ("48 CHAPTER FIVE"),
 *   which broke a match anchored to the very start of the line. The anchor now tolerates a
 *   short run of non-letter characters before "chapter".
 * - A centred heading whose number lands on its own line below "CHAPTER" - common when a
 *   PDF's text layer follows visual line breaks rather than logical ones. A lone "CHAPTER"
 *   line immediately followed by a lone number word is now treated as one heading, anchored
 *   at the "CHAPTER" line.
 *
 * Neither explained the next real miss: the document itself had "CHAPER FIVE" - a typo,
 * missing the T, in the student's own file. No amount of layout tolerance catches a
 * misspelling, so the word "chapter" is now matched within one typo (one inserted, deleted,
 * or substituted letter) rather than only literally - enough to survive a slipped keystroke
 * without also matching unrelated words, since a genuine seven-letter collision one edit
 * away from "chapter" immediately followed by "one" through "five" is not a realistic false
 * positive.
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

// Up to a handful of non-letter characters (a page number, a bullet, stray whitespace) may
// share the line before the word "chapter" itself - a running header or page footer merged
// onto the same line by extraction, not part of the heading.
const LEADING_NOISE = /^[^a-z]{0,10}/i;
const HEADING_WORDS = /^([a-z]+)\s+(one|two|three|four|five|[1-5])\b\s*[:.\-–]?\s*(.*)$/i;

// A heading whose number was pushed to its own line by a centred layout: "CHAPTER" alone,
// then just the number word on the next non-blank line.
const LONE_WORD_LINE = /^([a-z]+)\s*[:.\-–]?$/i;
const LONE_NUMBER_LINE = /^(one|two|three|four|five|[1-5])\b\s*[:.\-–]?\s*(.*)$/i;

// A real chapter of a final-year project runs to many pages. Anything shorter than this
// once split is treated as evidence of a bad boundary, not a short chapter.
const MIN_CHAPTER_WORDS = 120;

export function splitByChapter(text: string): ChapterSplit[] | null {
  const lines = text.split("\n");

  // Every occurrence of every chapter heading, in document order - a table of contents
  // entry and the real section start for the same chapter both land here; picking the
  // right one happens below.
  const occurrences = new Map<number, number[]>();
  const record = (chapter: number, lineIndex: number) => {
    const list = occurrences.get(chapter) ?? [];
    list.push(lineIndex);
    occurrences.set(chapter, list);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const chapterFromLine = matchHeadingLine(line);
    if (chapterFromLine !== null) {
      record(chapterFromLine, i);
      continue;
    }

    if (matchLoneChapterLine(line)) {
      const next = nextNonBlank(lines, i + 1);
      if (next) {
        const numberMatch = LONE_NUMBER_LINE.exec(next.text);
        const chapter = numberMatch ? CHAPTER_WORDS[numberMatch[1].toLowerCase()] : undefined;
        if (chapter !== undefined) record(chapter, i);
      }
    }
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

// Chapter number if `line` opens with "chapter" (within one typo) followed by a number
// word, after stripping any leading page-number/header noise - null otherwise.
function matchHeadingLine(line: string): number | null {
  const rest = line.slice(LEADING_NOISE.exec(line)?.[0].length ?? 0);
  const match = HEADING_WORDS.exec(rest);
  if (!match || !isChapterWord(match[1])) return null;
  return CHAPTER_WORDS[match[2].toLowerCase()];
}

// True if `line` is nothing but "chapter" (within one typo), possibly with leading noise
// and trailing punctuation - the first half of a heading split across two lines.
function matchLoneChapterLine(line: string): boolean {
  const rest = line.slice(LEADING_NOISE.exec(line)?.[0].length ?? 0);
  const match = LONE_WORD_LINE.exec(rest);
  return !!match && isChapterWord(match[1]);
}

const CHAPTER_TARGET = "chapter";

function isChapterWord(word: string): boolean {
  const w = word.toLowerCase();
  if (w === CHAPTER_TARGET) return true;
  if (Math.abs(w.length - CHAPTER_TARGET.length) > 1) return false;
  return editDistanceAtMostOne(w, CHAPTER_TARGET);
}

// True if `a` and `b` differ by at most one inserted, deleted, or substituted character.
// A real chapter heading survives a single slipped keystroke ("CHAPER FIVE") without also
// matching some unrelated word that happens to be one edit away from "chapter".
function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (longer.length - shorter.length > 1) return false;

  let i = 0;
  let j = 0;
  let usedEdit = false;
  const sameLength = shorter.length === longer.length;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
      continue;
    }
    if (usedEdit) return false;
    usedEdit = true;
    if (sameLength) {
      i++;
      j++;
    } else {
      j++;
    }
  }
  return true;
}

// The first non-blank line at or after `from`, skipped over when a heading's number has
// been pushed onto its own line. Stops after a few blank lines so an unrelated later
// paragraph is never mistaken for the missing other half of a heading.
function nextNonBlank(lines: string[], from: number): { text: string } | null {
  for (let i = from; i < lines.length && i < from + 3; i++) {
    const trimmed = lines[i].trim();
    if (trimmed) return { text: trimmed };
  }
  return null;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
