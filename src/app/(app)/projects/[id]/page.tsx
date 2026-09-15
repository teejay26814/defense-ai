import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { buttonStyles } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { CHAPTERS, DEGREE_LABELS, type DocumentSummary, type Project } from "@/lib/types";
import { DeleteProjectButton } from "./delete-project-button";
import { DocumentList } from "./document-list";
import { UploadForm } from "./upload-form";

export async function generateMetadata({
  params,
}: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return { title: data?.title ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // Both queries key off the route's id directly, not off each other's result, so they run
  // together - the not-found check happens once both are back.
  const [{ data: project }, { data: docs }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle<Project>(),
    // Selected as one literal, not a concatenation: the Supabase client parses this string
    // at the type level, and a joined expression collapses the row type to an error type.
    // `content` is deliberately excluded - it is large and unused in this view.
    supabase
      .from("documents")
      .select(
        "id, project_id, user_id, label, chapter, file_name, storage_path, mime_type, size_bytes, status, error_message, word_count, page_count, created_at, updated_at",
      )
      .eq("project_id", id)
      .order("chapter", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  // RLS makes another student's project indistinguishable from one that does not exist,
  // which is exactly right - a 404 leaks nothing about what other people have.
  if (!project) notFound();

  const documents = (docs ?? []) as DocumentSummary[];
  const ready = documents.filter((d) => d.status === "ready");
  const uploadedChapters = new Set(
    documents.filter((d) => d.chapter !== null).map((d) => d.chapter),
  );
  const missingChapters = CHAPTERS.filter((c) => !uploadedChapters.has(c.value));
  const totalWords = ready.reduce((sum, d) => sum + (d.word_count ?? 0), 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {project.topic && (
            <p className="mt-2 max-w-prose text-ink-muted">{project.topic}</p>
          )}
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
            {project.degree_level && (
              <div>
                <dt className="sr-only">Level</dt>
                <dd>{DEGREE_LABELS[project.degree_level]}</dd>
              </div>
            )}
            {project.institution && (
              <div>
                <dt className="sr-only">Institution</dt>
                <dd>{project.institution}</dd>
              </div>
            )}
            {project.supervisor && (
              <div>
                <dt className="sr-only">Supervisor</dt>
                <dd>Supervised by {project.supervisor}</dd>
              </div>
            )}
            {project.defense_date && (
              <div>
                <dt className="sr-only">Defense date</dt>
                <dd className="font-medium text-navy-500">
                  Defending{" "}
                  {new Date(project.defense_date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href={`/projects/${project.id}/edit`}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Edit details
          </Link>
        </div>
      </header>

      {/* What to do next - the dashboard guardrail applies here too. */}
      <section className="field-parchment surface-grain rounded-feature border border-navy-100 p-6 shadow-lifted">
        <p className="label-eyebrow text-navy-500">
          {missingChapters.length === 0 ? "All chapters in" : "Next step"}
        </p>
        <h2 className="mt-2 font-display text-xl text-ink">
          {missingChapters.length === 0
            ? "Your project is fully uploaded."
            : `Upload ${missingChapters[0].label} - ${missingChapters[0].hint}`}
        </h2>
        <p className="mt-1.5 text-sm text-ink-muted">
          {ready.length} of {documents.length || 0} document
          {documents.length === 1 ? "" : "s"} read
          {totalWords > 0 && ` · ${totalWords.toLocaleString()} words in your knowledge base`}
          {missingChapters.length > 0 &&
            ` · still to come: ${missingChapters.map((c) => c.value).join(", ")}`}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-4">
          <h2 className="font-display text-xl text-ink">Documents</h2>
          <DocumentList documents={documents} projectId={project.id} />
        </section>

        <aside className="space-y-4">
          <div className="rounded-feature border border-navy-100/70 bg-surface/70 p-5 shadow-raised">
            <h2 className="font-display text-lg text-ink">Add a document</h2>
            <p className="mt-1 mb-4 text-sm text-ink-muted">
              One chapter at a time works best.
            </p>
            <UploadForm projectId={project.id} />
          </div>

          <div className="rounded-feature border border-danger/20 bg-surface/60 p-5">
            <h2 className="font-display text-lg text-ink">Delete project</h2>
            <p className="mt-1 mb-3 text-sm text-ink-muted">
              Removes the project and every document in it. This cannot be undone.
            </p>
            <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
          </div>
        </aside>
      </div>
    </div>
  );
}
