import { notFound } from "next/navigation";

import { ProjectBackLink } from "@/components/project-back-link";
import { ProjectNav } from "@/components/project-nav";
import { getProjectHeading } from "@/lib/project-heading";
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

  // Neither query needs the other's result - both only need the route's id - so they run
  // together and the not-found check happens after, rather than gating the second query on
  // the first for no reason.
  const [project, { count }] = await Promise.all([
    getProjectHeading(id),
    // head:true returns the count without the rows, which is all this needs.
    supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("embedded", true),
  ]);

  // RLS makes another student's project indistinguishable from one that does not exist.
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div>
        <ProjectBackLink projectId={project.id} />
        {/*
          Long titles are the norm - thesis titles run to twenty words, often in capitals.
          At full size on a phone that filled the whole first screen of every project page,
          so it is smaller and clamped to three lines there; the full title stays in the
          tooltip and on larger screens.
        */}
        <h1
          title={project.title}
          className="mt-1.5 line-clamp-3 font-display text-xl leading-snug text-ink sm:text-2xl lg:line-clamp-none lg:text-3xl lg:leading-tight"
        >
          {project.title}
        </h1>
      </div>

      {/* On phones the bottom tab bar (components/mobile-nav.tsx) replaces this strip. */}
      <div className="hidden lg:block">
        <ProjectNav projectId={project.id} hasIndexedText={(count ?? 0) > 0} />
      </div>

      {children}
    </div>
  );
}
