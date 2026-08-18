import Link from "next/link";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { DEGREE_LABELS, type Project } from "@/lib/types";

export const metadata: Metadata = { title: "Your projects" };

type ProjectRow = Project & { documents: { count: number }[] };

export default async function ProjectsPage() {
  const supabase = await createClient();

  // RLS scopes this to the signed-in student - no user filter is needed here, and adding
  // one would only hide a policy mistake rather than prevent it.
  const { data } = await supabase
    .from("projects")
    .select("*, documents(count)")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as ProjectRow[];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Your projects</h1>
          <p className="mt-2 text-ink-muted">
            {projects.length === 0
              ? "Nothing here yet."
              : `${projects.length} project${projects.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-lg bg-navy-700 px-4 py-2.5 font-medium text-white shadow-elevated
            transition-[transform,background-color] duration-150
            hover:bg-navy-600 active:translate-y-px"
        >
          New project
        </Link>
      </header>

      {projects.length === 0 ? (
        <div className="field-parchment surface-grain rounded-2xl border border-navy-100 p-10 text-center shadow-elevated">
          <h2 className="font-display text-2xl text-ink">Start with your project</h2>
          <p className="mx-auto mt-2 max-w-md text-ink-muted">
            Add it once, upload your chapters, and everything after that is built from
            your own work.
          </p>
          <Link
            href="/projects/new"
            className="mt-6 inline-block rounded-lg bg-navy-700 px-5 py-2.5 font-medium text-white
              shadow-elevated transition-[transform,background-color] duration-150
              hover:bg-navy-600 active:translate-y-px"
          >
            Add your project
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => {
            const docCount = p.documents?.[0]?.count ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block h-full rounded-xl border border-navy-100 bg-white/70 p-5 shadow-base
                    transition-[transform,box-shadow,border-color] duration-200
                    hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-elevated
                    active:translate-y-0"
                >
                  <h2 className="font-display text-lg leading-snug text-ink">{p.title}</h2>

                  {p.topic && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{p.topic}</p>
                  )}

                  <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <div>
                      <dt className="sr-only">Documents</dt>
                      <dd>
                        {docCount} document{docCount === 1 ? "" : "s"}
                      </dd>
                    </div>
                    {p.degree_level && (
                      <div>
                        <dt className="sr-only">Level</dt>
                        <dd>{DEGREE_LABELS[p.degree_level]}</dd>
                      </div>
                    )}
                    {p.defense_date && (
                      <div>
                        <dt className="sr-only">Defense date</dt>
                        <dd className="font-medium text-gold">
                          {new Date(p.defense_date).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
