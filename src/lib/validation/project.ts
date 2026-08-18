import { z } from "zod";

import { ACCEPTED_MIME, MAX_FILE_BYTES, formatBytes } from "@/lib/types";

/** Mirrors the CHECK constraints in supabase/migrations/20260815180000_*.sql. */
export const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your project a title.")
    .max(300, "That title is too long."),
  topic: z
    .string()
    .trim()
    .max(2000, "Keep this under 2000 characters.")
    .optional()
    .transform((v) => v || undefined),
  degreeLevel: z
    .enum(["undergraduate", "masters", "phd", "other"])
    .optional(),
  institution: z.string().trim().max(200, "Too long.").optional().transform((v) => v || undefined),
  department: z.string().trim().max(200, "Too long.").optional().transform((v) => v || undefined),
  supervisor: z.string().trim().max(200, "Too long.").optional().transform((v) => v || undefined),
  defenseDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine(
      (v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
      "Use the date picker.",
    ),
});

export const documentMetaSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Give this document a label.")
    .max(200, "That label is too long."),
  chapter: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v >= 1 && v <= 20),
      "Pick a chapter between 1 and 20.",
    ),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

/**
 * File checks that must run on the server.
 *
 * The bucket enforces its own size and MIME limits, but failing here gives the student a
 * sentence they can act on instead of a storage API error - and it stops a large upload
 * being streamed only to be rejected at the end.
 */
export function validateUpload(file: File): string | null {
  if (!file || file.size === 0) return "Choose a file to upload.";
  if (file.size > MAX_FILE_BYTES) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)}.`;
  }

  const ext = "." + (file.name.toLowerCase().split(".").pop() ?? "");
  const extAllowed = Object.values(ACCEPTED_MIME).includes(ext);
  const mimeAllowed = Boolean(ACCEPTED_MIME[file.type]);

  // Browsers report an empty or wrong MIME type often enough that the extension has to be
  // accepted as a fallback - but one of the two must match.
  if (!mimeAllowed && !extAllowed) {
    return "Upload a PDF, Word document (.docx), or plain text file.";
  }
  return null;
}

/** Strips anything that could escape the storage path. */
export function safeFileName(name: string): string {
  return (
    name
      .replace(/[/\\]/g, "-")
      .replace(/[^\w.\- ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) || "document"
  );
}
