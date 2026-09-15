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
 * Deliberately conservative. Two failure modes matter more than missing a real split:
 *
 * 1. A table of contents lists every chapter heading before the real one appears
 *    ("CHAPTER ONE .................. 1"), which would otherwise be mistaken for the actual
 *    start of the chapter. Any heading-shaped line ending in dot-leaders and a page number
 *    is discarded before matching.
 * 2. A single stray mention of "Chapter One" in running prose is not evidence of a
 *    multi-chapter upload. At least two headings, strictly ascending, are required before
 *    this commits to anything. Short of that it returns null, and the caller treats the
 *    upload as one ordinary document - exactly what happened before this existed.
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

// A line ending in "....... 12" or "— 12" is a table-of-contents entry, not a heading.
const TOC_LINE = /(\.{2,}|[-–—])\s*\d{1,4}\s*$/;
const HEADING = /^chapter\s+(one|two|three|four|five|[1-5])\b\s*[:.\-–]?\s*(.*)$/i;

export function splitByChapter(text: string): ChapterSplit[] | null {
  const lines = text.split("\n");

  const found: { chapter: number; lineIndex: number; heading: string }[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || TOC_LINE.test(line)) continue;

    const match = HEADING.exec(line);
    if (!match) continue;

    const chapter = CHAPTER_WORDS[match[1].toLowerCase()];
    if (chapter === undefined || seen.has(chapter)) continue;

    seen.add(chapter);
    found.push({ chapter, lineIndex: i, heading: line });
  }

  if (found.length < 2) return null;

  // Out-of-order matches mean these are not real sequential headings (a cross-reference to
  // an earlier chapter, most likely) - better to do nothing than guess wrong.
  for (let i = 1; i < found.length; i++) {
    if (found[i].chapter <= found[i - 1].chapter) return null;
  }

  // Character offset of the start of each line, so slices come from the original text
  // rather than a re-joined copy that would lose its exact spacing.
  const lineStart: number[] = [0];
  for (const line of lines) lineStart.push(lineStart[lineStart.length - 1] + line.length + 1);

  return found.map((f, i) => {
    const start = lineStart[f.lineIndex];
    const end = i + 1 < found.length ? lineStart[found[i + 1].lineIndex] : text.length;
    return { chapter: f.chapter, heading: f.heading, text: text.slice(start, end).trim() };
  });
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
