import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types";
import { ProjectForm } from "../../project-form";
import { updateProject } from "../../actions";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: PageProps<"/projects/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle<Project>();

  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-6">
        <Link
          href={`/projects/${project.id}`}
          className="rounded text-sm text-ink-muted underline-offset-4
            transition-colors duration-150 hover:text-ink hover:underline"
        >
          ← {project.title}
        </Link>
      </nav>

      <header className="mb-8">
        <p className="label-eyebrow">Project details</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Edit details</h1>
      </header>

      <ProjectForm
        action={updateProject}
        project={project}
        submitLabel="Save changes"
      />
    </div>
  );
}
