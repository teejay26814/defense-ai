import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectNav } from "@/components/project-nav";
import { createClient } from "@/lib/supabase/server";

/**
 * Shell for every screen belonging to one project.
 *
 * The title and tabs live here so they survive navigation between Overview, Ask, Practice
 * and Quiz, instead of each page re-declaring its own way back. It also means a new
 * project screen is reachable the moment it exists, rather than needing a button added to
 * the overview page by hand.
 *
 * The indexed-text check is done once here and handed down, so four pages do not each run
 * their own count query to decide whether their tab should work.
 */
export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/projects/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  // RLS makes another student's project indistinguishable from one that does not exist.
  if (!project) notFound();

  // head:true returns the count without the rows, which is all this needs.
  const { count } = await supabase
    .from("chunks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id)
    .eq("embedded", true);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/projects"
          className="rounded text-sm text-ink-muted underline-offset-4
            transition-colors duration-150 hover:text-brand hover:underline"
        >
          ← All projects
        </Link>
        <h1 className="mt-1.5 font-display text-3xl leading-tight text-ink">
          {project.title}
        </h1>
      </div>

      <ProjectNav projectId={project.id} hasIndexedText={(count ?? 0) > 0} />

      {children}
    </div>
  );
}
