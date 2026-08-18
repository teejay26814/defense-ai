import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "Ask my project" };

export default async function AskPage({ params }: PageProps<"/projects/[id]/ask">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle<Project>();

  if (!project) notFound();

  // Only embedded chunks are retrievable, so this count is what the student can actually
  // ask against - not how much they have uploaded.
  const { count: searchable } = await supabase
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("embedded", true);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <nav>
        <Link
          href={`/projects/${project.id}`}
          className="rounded text-sm text-ink-muted underline-offset-4
            transition-colors duration-150 hover:text-ink hover:underline"
        >
          ← {project.title}
        </Link>
      </nav>

      <header>
        <h1 className="font-display text-3xl text-ink">Ask my project</h1>
        <p className="mt-2 text-ink-muted">
          Every answer comes from your own chapters, with the section it came from.
        </p>
      </header>

      {searchable === 0 ? (
        <div className="rounded-2xl border border-dashed border-navy-300 p-8 text-center">
          <h2 className="font-display text-xl text-ink">Nothing to search yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Upload a chapter first. Once it has been read and indexed, you can ask
            questions about it here.
          </p>
          <Link
            href={`/projects/${project.id}`}
            className="mt-5 inline-block rounded-lg bg-navy-700 px-4 py-2.5 text-sm font-medium text-white
              shadow-elevated transition-[transform,background-color] duration-150
              hover:bg-navy-600 active:translate-y-px"
          >
            Upload a chapter
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-muted">
            Searching {searchable?.toLocaleString()} section
            {searchable === 1 ? "" : "s"} of your project.
          </p>
          <AskForm projectId={project.id} />
        </>
      )}
    </div>
  );
}
