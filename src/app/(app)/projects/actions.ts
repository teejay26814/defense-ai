"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { splitByChapter, wordCount } from "@/lib/chapter-split";
import { extractText, ExtractionError } from "@/lib/extract";
import { indexDocument } from "@/lib/indexing";
import { currentPlan, PLANS, type Plan } from "@/lib/plans";
import { CHAPTERS, STORAGE_BUCKET } from "@/lib/types";
import { toFieldErrors } from "@/lib/validation/auth";
import {
  documentMetaSchema,
  projectSchema,
  safeFileName,
  validateUpload,
  type ActionState,
} from "@/lib/validation/project";

/**
 * Every action re-reads the user from the auth server rather than trusting anything the
 * form sent. RLS would catch a forged id anyway, but failing here gives a clean error
 * instead of a confusing empty result.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = projectSchema.safeParse({
    title: formData.get("title"),
    topic: formData.get("topic") ?? undefined,
    degreeLevel: formData.get("degreeLevel") || undefined,
    institution: formData.get("institution") ?? undefined,
    department: formData.get("department") ?? undefined,
    supervisor: formData.get("supervisor") ?? undefined,
    defenseDate: formData.get("defenseDate") ?? undefined,
  });

  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { supabase, user } = await requireUser();
  const d = parsed.data;

  // One project per plan. Enforced here rather than only hidden in the UI.
  const plan = await currentPlan(supabase);
  const { count: existing } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((existing ?? 0) >= PLANS[plan].projects) {
    return {
      error:
        "Your plan covers one project. Open your existing project, or delete it to start a new one.",
    };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title: d.title,
      topic: d.topic ?? null,
      degree_level: d.degreeLevel ?? null,
      institution: d.institution ?? null,
      department: d.department ?? null,
      supervisor: d.supervisor ?? null,
      defense_date: d.defenseDate ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createProject]", error);
    return { error: "Your project could not be created. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("projectId") ?? "");
  if (!id) return { error: "Missing project." };

  const parsed = projectSchema.safeParse({
    title: formData.get("title"),
    topic: formData.get("topic") ?? undefined,
    degreeLevel: formData.get("degreeLevel") || undefined,
    institution: formData.get("institution") ?? undefined,
    department: formData.get("department") ?? undefined,
    supervisor: formData.get("supervisor") ?? undefined,
    defenseDate: formData.get("defenseDate") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { supabase, user } = await requireUser();
  const d = parsed.data;

  const { error } = await supabase
    .from("projects")
    .update({
      title: d.title,
      topic: d.topic ?? null,
      degree_level: d.degreeLevel ?? null,
      institution: d.institution ?? null,
      department: d.department ?? null,
      supervisor: d.supervisor ?? null,
      defense_date: d.defenseDate ?? null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[updateProject]", error);
    return { error: "Those changes could not be saved." };
  }

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  return { notice: "Saved." };
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("projectId") ?? "");
  if (!id) return;

  const { supabase, user } = await requireUser();

  // Remove the files first. The database row cascades to documents, but storage objects
  // are not part of that cascade - deleting the row first would orphan them permanently.
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("project_id", id)
    .eq("user_id", user.id);

  if (docs?.length) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(docs.map((d) => d.storage_path));
    if (error) console.error("[deleteProject] storage cleanup", error);
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) console.error("[deleteProject]", error);

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function uploadDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Missing project." };

  const meta = documentMetaSchema.safeParse({
    label: formData.get("label"),
    chapter: formData.get("chapter") ?? undefined,
  });
  if (!meta.success) return { fieldErrors: toFieldErrors(meta.error) };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file to upload." };

  const fileProblem = validateUpload(file);
  if (fileProblem) return { fieldErrors: { file: [fileProblem] } };

  const { supabase, user } = await requireUser();

  // Confirm the project is this student's before writing anything. RLS enforces it too,
  // but this turns a silent policy rejection into a clear message.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) return { error: "That project could not be found." };

  // Chapter limits. Every indexed chapter feeds the AI features, so this is part of what
  // the plan buys: Free covers Chapter 1, Proposal 1-3, Final 1-5.
  const plan = await currentPlan(supabase);
  const maxChapter = PLANS[plan].chapters;
  const chosen = meta.data.chapter;

  if (chosen !== undefined && chosen > maxChapter) {
    return { error: chapterLimitMessage(plan, maxChapter) };
  }
  // A whole-project upload (no chapter picked) is split into chapters below, and any beyond
  // the plan are skipped. On free that would still let the entire project in as one
  // unsplit document whenever no chapter breaks are found, so free uploads must name their
  // chapter.
  if (chosen === undefined && maxChapter < 2) {
    return {
      fieldErrors: {
        chapter: ["On the free plan, choose Chapter 1. Upgrade to upload more chapters."],
      },
    };
  }

  const cleanName = safeFileName(file.name);
  const ext = cleanName.includes(".") ? cleanName.split(".").pop() : "bin";
  // The first path segment must be the user id - the storage policies pivot on it.
  const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}.${ext}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("[uploadDocument] storage", uploadError);
    return { error: "The file could not be uploaded. Please try again." };
  }

  const { data: doc, error: insertError } = await supabase
    .from("documents")
    .insert({
      project_id: projectId,
      user_id: user.id,
      label: meta.data.label,
      chapter: meta.data.chapter ?? null,
      file_name: cleanName,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      status: "extracting",
    })
    .select("id")
    .single();

  if (insertError || !doc) {
    // Do not leave a file behind with no row pointing at it.
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    console.error("[uploadDocument] insert", insertError);
    return { error: "The document could not be saved. Please try again." };
  }

  // Extraction runs inline. It is fast for the file sizes allowed here, and doing it now
  // means the student sees a real result rather than a row stuck on "processing" with no
  // worker behind it.
  let indexNote = "";
  try {
    const result = await extractText(buffer, file.type, cleanName);

    // No chapter was picked, which is the signal a student uses to say "this is more than
    // one chapter" - so look for real chapter breaks before treating it as one document.
    // If nothing confident is found, split is null and everything below behaves exactly as
    // it did before this existed: one row, the whole text, chapter left blank.
    const fullSplit = meta.data.chapter === undefined ? splitByChapter(result.text) : null;
    // Chapters beyond the plan are dropped before anything is stored or indexed.
    const split = fullSplit?.filter((part) => part.chapter <= maxChapter) ?? null;
    const skippedChapters = (fullSplit?.length ?? 0) - (split?.length ?? 0);
    if (fullSplit && split && split.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: chapterLimitMessage(plan, maxChapter) })
        .eq("id", doc.id)
        .eq("user_id", user.id);
      revalidatePath(`/projects/${projectId}`);
      return { error: chapterLimitMessage(plan, maxChapter) };
    }

    if (!split) {
      await supabase
        .from("documents")
        .update({
          status: "ready",
          content: result.text,
          word_count: result.wordCount,
          page_count: result.pageCount,
          error_message: null,
        })
        .eq("id", doc.id)
        .eq("user_id", user.id);

      try {
        const indexed = await indexDocument(supabase, {
          documentId: doc.id,
          projectId,
          userId: user.id,
          text: result.text,
        });
        indexNote = indexed.skipped
          ? ` ${indexed.chunkCount} sections saved - ${indexed.skipped}.`
          : ` ${indexed.embeddedCount} of ${indexed.chunkCount} sections are searchable.`;
      } catch (err) {
        console.error("[uploadDocument] indexing failed", err);
        indexNote = " It could not be made searchable yet - use “Try again” on the document.";
      }
    } else {
      // A confident split. The already-inserted row becomes chapter one rather than being
      // discarded, and one more row is created per remaining chapter found - each gets its
      // own real copy of the uploaded bytes in storage, not a shared reference, so deleting
      // or retrying any single chapter later never touches the others.
      //
      // Page count is left null on every split-derived row: extractText's page count
      // describes the whole uploaded file, and attributing all of it to just one chapter's
      // slice would be a made-up number, not an estimate.
      const chapterLabel = (n: number) => CHAPTERS.find((c) => c.value === n)?.label ?? `Chapter ${n}`;
      let embeddedTotal = 0;
      let chunkTotal = 0;
      let anySkipped = false;
      let failures = 0;

      for (let i = 0; i < split.length; i++) {
        const part = split[i];
        const isFirst = i === 0;

        try {
          let documentId: string;

          if (isFirst) {
            documentId = doc.id;
            await supabase
              .from("documents")
              .update({
                status: "ready",
                chapter: part.chapter,
                label: `${meta.data.label} - ${chapterLabel(part.chapter)}`,
                content: part.text,
                word_count: wordCount(part.text),
                page_count: null,
                error_message: null,
              })
              .eq("id", doc.id)
              .eq("user_id", user.id);
          } else {
            const partPath = `${user.id}/${projectId}/${crypto.randomUUID()}.${ext}`;
            const { error: partUploadError } = await supabase.storage
              .from(STORAGE_BUCKET)
              .upload(partPath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
              });
            if (partUploadError) throw partUploadError;

            const { data: partDoc, error: partInsertError } = await supabase
              .from("documents")
              .insert({
                project_id: projectId,
                user_id: user.id,
                label: `${meta.data.label} - ${chapterLabel(part.chapter)}`,
                chapter: part.chapter,
                file_name: cleanName,
                storage_path: partPath,
                mime_type: file.type || "application/octet-stream",
                size_bytes: file.size,
                status: "ready",
                content: part.text,
                word_count: wordCount(part.text),
                page_count: null,
              })
              .select("id")
              .single();

            if (partInsertError || !partDoc) {
              await supabase.storage.from(STORAGE_BUCKET).remove([partPath]);
              throw partInsertError ?? new Error("insert failed");
            }
            documentId = partDoc.id;
          }

          const indexed = await indexDocument(supabase, {
            documentId,
            projectId,
            userId: user.id,
            text: part.text,
          });
          chunkTotal += indexed.chunkCount;
          embeddedTotal += indexed.embeddedCount;
          if (indexed.skipped) anySkipped = true;
        } catch (err) {
          console.error(`[uploadDocument] chapter ${part.chapter} failed`, err);
          failures++;
        }
      }

      const ok = split.length - failures;
      indexNote =
        ` Split into ${ok} chapter${ok === 1 ? "" : "s"}` +
        (failures > 0 ? `, ${failures} could not be saved` : "") +
        (anySkipped
          ? ` - ${chunkTotal} sections saved, some not yet searchable.`
          : ` - ${embeddedTotal} of ${chunkTotal} sections are searchable.`) +
        (skippedChapters > 0
          ? ` ${skippedChapters} later chapter${skippedChapters === 1 ? " was" : "s were"} left out - your plan covers Chapters 1 to ${maxChapter}.`
          : "");
    }
  } catch (err) {
    const message =
      err instanceof ExtractionError
        ? err.message
        : "This file could not be read.";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", doc.id)
      .eq("user_id", user.id);

    revalidatePath(`/projects/${projectId}`);
    // The upload itself succeeded - the file is stored and the row exists. Say what
    // actually happened rather than implying nothing was saved.
    return {
      error: `${message} The file was kept, so you can replace it or remove it.`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { notice: `“${meta.data.label}” uploaded and read.${indexNote}` };
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get("documentId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!id) return;

  const { supabase, user } = await requireUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (doc) {
    await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
  }

  await supabase.from("documents").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/** Re-runs extraction for a document that failed, without a re-upload. */
export async function retryExtraction(formData: FormData) {
  const id = String(formData.get("documentId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!id) return;

  const { supabase, user } = await requireUser();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, project_id, storage_path, mime_type, file_name, chapter")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!doc) return;

  await supabase
    .from("documents")
    .update({ status: "extracting", error_message: null })
    .eq("id", id)
    .eq("user_id", user.id);

  const { data: blob, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(doc.storage_path);

  if (error || !blob) {
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: "The stored file could not be read." })
      .eq("id", id)
      .eq("user_id", user.id);
    revalidatePath(`/projects/${projectId}`);
    return;
  }

  try {
    const result = await extractText(await blob.arrayBuffer(), doc.mime_type, doc.file_name);

    // If this row belongs to a chapter, try to re-isolate just that chapter's text from
    // the freshly re-extracted whole file, the same way the original upload did. A row
    // created from a single-chapter upload will not find a confident split here either
    // (there is only one chapter's worth of text to search), so this falls back to the
    // full re-extracted text exactly as it always did.
    const isolated =
      doc.chapter !== null
        ? splitByChapter(result.text)?.find((s) => s.chapter === doc.chapter)
        : null;
    const text = isolated?.text ?? result.text;

    await supabase
      .from("documents")
      .update({
        status: "ready",
        content: text,
        word_count: isolated ? wordCount(text) : result.wordCount,
        page_count: isolated ? null : result.pageCount,
        error_message: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    // Rebuild the search index too - this is the path a student uses after a failure, so
    // it has to fix retrieval as well as extraction. Failing here leaves the document
    // readable but not searchable, which is recoverable by pressing it again.
    try {
      await indexDocument(supabase, {
        documentId: id,
        projectId: doc.project_id,
        userId: user.id,
        text,
      });
    } catch (indexErr) {
      console.error("[retryExtraction] indexing failed", indexErr);
    }
  } catch (err) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message:
          err instanceof ExtractionError ? err.message : "This file could not be read.",
      })
      .eq("id", id)
      .eq("user_id", user.id);
  }

  revalidatePath(`/projects/${projectId}`);
}

function chapterLimitMessage(plan: Plan, maxChapter: number): string {
  if (plan === "free") {
    return "The free plan covers Chapter 1. Upgrade to add more chapters.";
  }
  if (plan === "proposal") {
    return `Your Proposal plan covers Chapters 1 to ${maxChapter}. Upgrade to Final defense for Chapters 4 and 5.`;
  }
  return `Your plan covers Chapters 1 to ${maxChapter}.`;
}
