/**
 * Row shapes for the tables this app reads.
 *
 * Hand-written rather than generated: `supabase gen types` needs Docker or a linked
 * project, and neither is available in every environment this runs in. Keep these in step
 * with supabase/migrations/ by hand.
 */

export type DegreeLevel = "undergraduate" | "masters" | "phd" | "other";

export type DocumentStatus = "uploaded" | "extracting" | "ready" | "failed";

export type Profile = {
  id: string;
  full_name: string | null;
  institution: string | null;
  department: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  degree_level: DegreeLevel | null;
  institution: string | null;
  department: string | null;
  supervisor: string | null;
  defense_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectDocument = {
  id: string;
  project_id: string;
  user_id: string;
  label: string;
  chapter: number | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  error_message: string | null;
  content: string | null;
  word_count: number | null;
  page_count: number | null;
  created_at: string;
  updated_at: string;
};

/** `content` is deliberately omitted - it is large and never needed in a list view. */
export type DocumentSummary = Omit<ProjectDocument, "content">;

export const DEGREE_LABELS: Record<DegreeLevel, string> = {
  undergraduate: "Undergraduate",
  masters: "Master's",
  phd: "PhD",
  other: "Other",
};

/**
 * The five chapters a project is normally built from. Students can label a document
 * anything, but offering the standard structure is what makes the upload step feel like
 * it understands their project rather than being a generic file picker.
 */
export const CHAPTERS: { value: number; label: string; hint: string }[] = [
  { value: 1, label: "Chapter One", hint: "Introduction" },
  { value: 2, label: "Chapter Two", hint: "Literature Review" },
  { value: 3, label: "Chapter Three", hint: "Methodology" },
  { value: 4, label: "Chapter Four", hint: "Results & Discussion" },
  { value: 5, label: "Chapter Five", hint: "Conclusion & Recommendations" },
];

/**
 * What the student is actually sitting for.
 *
 * These are distinct events, not difficulty settings. A proposal or seminar defense covers
 * Chapters One to Three and a panel cannot ask about findings that do not exist yet; a
 * final defense covers everything. Getting this wrong produces questions a student will
 * never be asked, which wastes the only preparation time they have.
 *
 * It also means a student who has uploaded one chapter gets a complete experience rather
 * than a broken version of the full one.
 */
export type DefenseScope = "chapter" | "proposal" | "final";

export const DEFENSE_SCOPES: {
  value: DefenseScope;
  label: string;
  hint: string;
  chapters: number[];
}[] = [
  {
    value: "chapter",
    label: "One chapter",
    hint: "A chapter review or supervisor meeting",
    chapters: [1],
  },
  {
    value: "proposal",
    label: "Proposal defense",
    hint: "Chapters One to Three, before you collect data",
    chapters: [1, 2, 3],
  },
  {
    value: "final",
    label: "Final defense",
    hint: "The whole project, Chapters One to Five",
    chapters: [1, 2, 3, 4, 5],
  },
];

export type Question = {
  id: string;
  project_id: string;
  user_id: string;
  chapter: number | null;
  question: string;
  model_answer: string;
  source_chunk_ids: string[];
  difficulty: number;
  /** Null on questions generated before quiz mode existed; those still work as flashcards. */
  options: string[] | null;
  correct_option: number | null;
  times_seen: number;
  last_seen_at: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type Mnemonic = {
  id: string;
  project_id: string;
  user_id: string;
  chapter: number | null;
  title: string;
  items: string[];
  aid: string;
  explanation: string | null;
  created_at: string;
  updated_at: string;
};

/** 1 recall, 2 explain, 3 defend - the escalation a real panel follows. */
export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Recall",
  2: "Explain",
  3: "Defend",
};

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Shaky",
  2: "Getting there",
  3: "Solid",
};

export const STORAGE_BUCKET = "project-documents";

/** Mirrors the bucket's file_size_limit in the migration. Keep the two in step. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
