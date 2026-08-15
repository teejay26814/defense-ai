import Link from "next/link";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { CHAPTERS, type Project } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

type ProjectWithDocs = Project & {
  documents: { chapter: number | null; status: string; word_count: number | null }[];
};

/**
 * The dashboard must always answer: what do I need to do next?
 *
 * That answer is computed from real state — no project, no documents, a gap in the
 * chapters, or something that failed to read — rather than shown as a fixed checklist.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const { data } = await supabase
    .from("projects")
    .select("*, documents(chapter, status, word_count)")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as ProjectWithDocs[];
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const current = projects[0];

  const docs = current?.documents ?? [];
  const failed = docs.filter((d) => d.status === "failed").length;
  const uploaded = new Set(docs.filter((d) => d.chapter !== null).map((d) => d.chapter));
  const missing = CHAPTERS.filter((c) => !uploaded.has(c.value));
  const words = docs.reduce((s, d) => s + (d.word_count ?? 0), 0);

  const next = !current
    ? {
        eyebrow: "Next step",
        title: "Add your project",
        body: "Tell us what you are defending, then upload your chapters.",
        href: "/projects/new",
        cta: "Add your project",
      }
    : failed > 0
      ? {
          eyebrow: "Needs attention",
          title: `${failed} document${failed === 1 ? "" : "s"} could not be read`,
          body: "Open the project to see why, and replace or retry them.",
          href: `/projects/${current.id}`,
          cta: "Review documents",
        }
      : docs.length === 0
        ? {
            eyebrow: "Next step",
            title: "Upload your first chapter",
            body: "Your knowledge base is built from what you upload.",
            href: `/projects/${current.id}`,
            cta: "Upload a chapter",
          }
        : missing.length > 0
          ? {
              eyebrow: "Next step",
              title: `Upload ${missing[0].label} — ${missing[0].hint}`,
              body: `${docs.length} document${docs.length === 1 ? "" : "s"} in so far${
                words > 0 ? `, ${words.toLocaleString()} words` : ""
              }.`,
              href: `/projects/${current.id}`,
              cta: "Continue uploading",
            }
          : {
              eyebrow: "All chapters in",
              title: "Your project is fully uploaded",
              body: `${words.toLocaleString()} words are ready. Practice tools arrive in the next phase.`,
              href: `/projects/${current.id}`,
              cta: "Review your project",
            };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">
          {firstName ? `Welcome, ${firstName}.` : "Welcome."}
        </h1>
        <p className="mt-2 text-ink-muted">Here is what to do next.</p>
      </header>

      <section className="field-parchment surface-grain rounded-2xl border border-navy-100 p-8 shadow-elevated">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          {next.eyebrow}
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">{next.title}</h2>
        <p className="mt-2 max-w-prose text-ink-muted">{next.body}</p>
        <Link
          href={next.href}
          className="mt-6 inline-block rounded-lg bg-navy-700 px-4 py-2.5 font-medium text-white
            shadow-elevated transition-[transform,background-color] duration-150
            hover:bg-navy-600 active:translate-y-px"
        >
          {next.cta}
        </Link>
      </section>

      {projects.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Your projects</h2>
            <Link
              href="/projects"
              className="rounded text-sm text-navy-500 underline-offset-4
                transition-colors duration-150 hover:text-navy-700 hover:underline"
            >
              See all
            </Link>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {projects.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block h-full rounded-xl border border-navy-100 bg-white/70 p-5 shadow-base
                    transition-[transform,box-shadow,border-color] duration-200
                    hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-elevated
                    active:translate-y-0"
                >
                  <h3 className="font-display text-lg leading-snug text-ink">{p.title}</h3>
                  <p className="mt-2 text-xs text-ink-muted">
                    {p.documents.length} document{p.documents.length === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
