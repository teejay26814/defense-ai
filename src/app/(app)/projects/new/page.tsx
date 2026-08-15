import Link from "next/link";
import type { Metadata } from "next";

import { ProjectForm } from "../project-form";
import { createProject } from "../actions";

export const metadata: Metadata = { title: "New project" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-6">
        <Link
          href="/projects"
          className="rounded text-sm text-ink-muted underline-offset-4
            transition-colors duration-150 hover:text-ink hover:underline"
        >
          ← Projects
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Add your project</h1>
        <p className="mt-2 text-ink-muted">
          Only the title is required — everything else sharpens the questions you will be
          asked later, and can be filled in whenever you like.
        </p>
      </header>

      <ProjectForm action={createProject} submitLabel="Create project" />
    </div>
  );
}
