"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { extractText, ExtractionError } from "@/lib/extract";
import { STORAGE_BUCKET } from "@/lib/types";
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
  // are not part of that cascade — deleting the row first would orphan them permanently.
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

  const cleanName = safeFileName(file.name);
  const ext = cleanName.includes(".") ? cleanName.split(".").pop() : "bin";
  // The first path segment must be the user id — the storage policies pivot on it.
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
  // worker behind it. Moving this to a queue is a Phase 3 concern.
  try {
    const result = await extractText(buffer, file.type, cleanName);
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
    // The upload itself succeeded — the file is stored and the row exists. Say what
    // actually happened rather than implying nothing was saved.
    return {
      error: `${message} The file was kept, so you can replace it or remove it.`,
    };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { notice: `“${meta.data.label}” uploaded and read.` };
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
    .select("id, storage_path, mime_type, file_name")
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
    await supabase
      .from("documents")
      .update({
        status: "ready",
        content: result.text,
        word_count: result.wordCount,
        page_count: result.pageCount,
        error_message: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);
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
