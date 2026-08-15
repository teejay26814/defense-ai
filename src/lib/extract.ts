import "server-only";

/**
 * Plain-text extraction from an uploaded document.
 *
 * This is the whole of "document processing" for Phase 2: get trustworthy text out of the
 * file and store it. Chunking, embeddings and retrieval are Phase 3 and deliberately not
 * started here.
 *
 * Nothing in this module calls an AI provider. Extraction is parsing, not inference — the
 * text must be exactly what the student wrote, because every later answer is grounded in
 * it and cites it.
 */

export type ExtractResult = {
  text: string;
  wordCount: number;
  pageCount: number | null;
};

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Collapses the ragged whitespace that PDF extraction always produces. */
function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    // Rejoin words split across a line break by hyphenation.
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}

async function extractPdf(buffer: ArrayBuffer): Promise<ExtractResult> {
  // unpdf bundles a serverless build of pdf.js, so there is no worker or DOM to set up.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = normalise(Array.isArray(text) ? text.join("\n\n") : text);

  if (!merged) {
    throw new ExtractionError(
      "No text could be read from this PDF. If it is a scan or a photograph of pages, " +
        "the text is an image — export a text-based PDF from your word processor instead.",
    );
  }

  return { text: merged, wordCount: countWords(merged), pageCount: totalPages ?? null };
}

async function extractDocx(buffer: ArrayBuffer): Promise<ExtractResult> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const text = normalise(value);

  if (!text) {
    throw new ExtractionError("This document appears to be empty.");
  }

  // A .docx has no fixed page count — pagination is decided at render time by the word
  // processor, so reporting one here would be a guess.
  return { text, wordCount: countWords(text), pageCount: null };
}

function extractPlain(buffer: ArrayBuffer): ExtractResult {
  const text = normalise(new TextDecoder("utf-8").decode(buffer));
  if (!text) throw new ExtractionError("This file is empty.");
  return { text, wordCount: countWords(text), pageCount: null };
}

export async function extractText(
  buffer: ArrayBuffer,
  mimeType: string,
  fileName: string,
): Promise<ExtractResult> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  try {
    if (mimeType === "application/pdf" || ext === "pdf") {
      return await extractPdf(buffer);
    }
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return await extractDocx(buffer);
    }
    if (mimeType.startsWith("text/") || ext === "txt" || ext === "md") {
      return extractPlain(buffer);
    }
    if (ext === "doc") {
      throw new ExtractionError(
        "Legacy .doc files cannot be read. Open it in Word and save as .docx or PDF.",
      );
    }
    throw new ExtractionError(`Unsupported file type: ${mimeType || ext || "unknown"}.`);
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    // Anything thrown by a parser is turned into something a student can act on; the
    // original goes to the server log rather than the screen.
    console.error("[extract] failed", { fileName, mimeType, err });
    throw new ExtractionError(
      "This file could not be read. It may be corrupted, password-protected, or not " +
        "the format its name suggests.",
    );
  }
}
