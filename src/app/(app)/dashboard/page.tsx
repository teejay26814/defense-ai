import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardTitle } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ReadinessMeter } from "@/components/readiness-meter";
import {
  ChapterProgress,
  chapterStateFrom,
  type ChapterState,
} from "@/components/chapter-progress";
import { createClient } from "@/lib/supabase/server";
import {
  CHAPTERS,
  readinessBand,
  type DocumentStatus,
  type Project,
} from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

type ProjectWithDocs = Project & {
  documents: {
    id: string;
    chapter: number | null;
    status: DocumentStatus;
    word_count: number | null;
  }[];
};

/**
 * The dashboard must always answer: what do I need to do next?
 *
 * That answer is computed from real state - no project, no documents, a gap in the
 * chapters, or something that failed to read - rather than shown as a fixed checklist.
 *
 * The coverage figure is deliberately *not* called a readiness score. It measures how much
 * of the project is uploaded and searchable, which is all this phase can honestly know. A
 * real readiness score needs answers graded against the project, which arrives with the
 * mock defense. Showing an invented number here would undermine the one question the whole
 * product exists to answer.
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
    .select("*, documents(id, chapter, status, word_count)")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as ProjectWithDocs[];
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const current = projects[0];

  const docs = current?.documents ?? [];

  // Which documents actually made it into the index. A document can be extracted but not
  // yet embedded, and only embedded text is askable - so the two are tracked separately.
  const embeddedDocs = new Set<string>();
  if (current) {
    const { data: chunkRows } = await supabase
      .from("chunks")
      .select("document_id, embedded")
      .eq("project_id", current.id)
      .eq("embedded", true);

    for (const row of chunkRows ?? []) embeddedDocs.add(row.document_id as string);
  }

  const chapterStates = new Map<number, ChapterState>();
  for (const doc of docs) {
    if (doc.chapter === null) continue;
    const state = chapterStateFrom(doc.status, embeddedDocs.has(doc.id));
    // If a chapter has several documents, the worst state wins - a student should see the
    // problem, not the one file that happened to work.
    const rank: Record<ChapterState, number> = {
      failed: 0,
      missing: 1,
      processing: 2,
      ready: 3,
    };
    const existing = chapterStates.get(doc.chapter);
    if (!existing || rank[state] < rank[existing]) chapterStates.set(doc.chapter, state);
  }

  const failed = docs.filter((d) => d.status === "failed").length;
  const uploaded = new Set(docs.filter((d) => d.chapter !== null).map((d) => d.chapter));
  const missing = CHAPTERS.filter((c) => !uploaded.has(c.value));
  const words = docs.reduce((s, d) => s + (d.word_count ?? 0), 0);

  const indexed = [...chapterStates.values()].filter((s) => s === "ready").length;
  const coverage = (indexed / CHAPTERS.length) * 100;

  // Once a mock defense has been sat, readiness replaces coverage. The *latest* sitting,
  // not the best one: this figure answers "would you be ready tomorrow", and the best score
  // a student ever got is not an answer to that.
  let readiness: number | null = null;
  if (current) {
    const { data: lastSitting } = await supabase
      .from("defense_sessions")
      .select("readiness")
      .eq("project_id", current.id)
      .eq("status", "complete")
      .not("readiness", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    readiness = (lastSitting?.readiness as number | null) ?? null;
  }

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
              title: `Upload ${missing[0].label} - ${missing[0].hint}`,
              body: `${docs.length} document${docs.length === 1 ? "" : "s"} in so far${
                words > 0 ? `, ${words.toLocaleString()} words` : ""
              }.`,
              href: `/projects/${current.id}`,
              cta: "Continue uploading",
            }
          : {
              eyebrow: "All chapters in",
              title: "Your project is fully uploaded",
              body: `${words.toLocaleString()} words are ready. Ask your project anything.`,
              href: `/projects/${current.id}/ask`,
              cta: "Ask my project",
            };

  return (
    <div className="space-y-8">
      <header className="pt-2">
        <p className="label-eyebrow">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">
          {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        </h1>
      </header>

      {/*
        The focal panel. Deliberately the only dark surface on the page: one thing carrying
        the weight is what gives a screen a centre, and a page of equally weighted white
        cards is exactly what reads as unconsidered.
      */}
      <section className="field-navy surface-grain animate-rise relative overflow-hidden rounded-feature p-8 text-white shadow-overlay sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="label-eyebrow text-gold">{next.eyebrow}</p>
          <h2 className="mt-3 font-display text-3xl leading-tight text-white sm:text-4xl">
            {next.title}
          </h2>
          <p className="measure mt-4 text-base leading-relaxed text-white/70">{next.body}</p>
          <Link
            href={next.href}
            className={`mt-8 ${buttonStyles({ variant: "accent", size: "lg" })}`}
          >
            {next.cta}
          </Link>
        </div>

        {/*
          A ruled field bleeding off the right edge. Asymmetric on purpose - it is the
          cheapest way to make a panel read as composed rather than as a centred box, and
          it echoes the ruled paper the product is about.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-0 hidden h-full w-80 opacity-[0.16] lg:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.9) 0 1px, transparent 1px 14px)",
            maskImage: "linear-gradient(to left, black, transparent 85%)",
          }}
        />
      </section>

      {/*
        Straight into the work. The dashboard's job is to answer "what do I do next?", and
        for a student whose chapters are already indexed the answer is almost never "open
        the project page" - it is practice, or asking something. Making them drill through the
        project to find these was the single worst thing about getting around the app.
      */}
      {current && indexed > 0 && (
        <section>
          <h2 className="label-eyebrow mb-4">Practise</h2>
          {/*
            A numbered list rather than a card grid. Four equal white boxes carry no
            hierarchy and read as a template; a ruled list with figures reads as an index,
            which is both more honest about what it is and considerably harder to mistake
            for a landing page.
          */}
          <ul className="stagger-children rule-hairline border-t border-navy-100">
            {[
              {
                href: `/projects/${current.id}/ask`,
                title: "Ask my project",
                body: "An answer from your own chapters, with the section it came from.",
              },
              {
                href: `/projects/${current.id}/questions`,
                title: "Practice questions",
                body: "Questions a panel would ask, answered in your own words.",
              },
              {
                href: `/projects/${current.id}/quiz`,
                title: "Quiz",
                body: "Multiple choice, drawn from what you wrote.",
              },
              {
                href: `/projects/${current.id}/defense`,
                title: "Mock defense",
                body: "Answer from memory and be marked against your project.",
              },
            ].map((tool, i) => (
              <li key={tool.href} className="rule-hairline">
                <Link
                  href={tool.href}
                  className="press group flex items-baseline gap-5 py-5
                    transition-[background-color,padding] duration-200
                    hover:bg-navy-050/60 hover:px-4 sm:gap-7"
                >
                  <span className="figures-data label-eyebrow w-6 shrink-0 pt-1 text-navy-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-xl text-ink">{tool.title}</span>
                    <span className="measure mt-1 block text-sm text-ink-muted">
                      {tool.body}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 pt-1 text-navy-300 transition-transform duration-200
                      group-hover:translate-x-1 group-hover:text-navy-700"
                  >
                    &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {current && (
        <section className="stagger-children grid gap-4 lg:grid-cols-5">
          <Card elevation="base" className="lg:col-span-2">
            <CardTitle className="font-display">
              {readiness !== null ? "Defense readiness" : "Knowledge base"}
            </CardTitle>
            <p className="mt-1 mb-5 text-sm text-ink-muted">
              {readiness !== null
                ? readinessBand(readiness).label
                : "How much of your project is searchable."}
            </p>

            <ReadinessMeter
              value={readiness ?? coverage}
              caption={
                readiness !== null
                  ? `${readinessBand(readiness).note} From your last mock defense.`
                  : indexed === CHAPTERS.length
                    ? "Every chapter is indexed. Sit a mock defense to turn this into a real readiness score."
                    : "Counts chapters that are uploaded and indexed. Your defense readiness score arrives once you sit a mock defense."
              }
            />

            {readiness === null && indexed > 0 && (
              <Link
                href={`/projects/${current.id}/defense`}
                className={`mt-5 ${buttonStyles({ variant: "secondary", size: "sm" })}`}
              >
                Sit a mock defense
              </Link>
            )}
          </Card>

          <Card elevation="base" className="lg:col-span-3">
            <CardTitle className="font-display">Your chapters</CardTitle>
            <p className="mt-1 mb-4 text-sm text-ink-muted">
              {indexed} of {CHAPTERS.length} indexed
              {words > 0 ? ` · ${words.toLocaleString()} words` : ""}
            </p>

            <ChapterProgress states={chapterStates} />
          </Card>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Your projects</h2>
          {projects.length > 0 && (
            <Link
              href="/projects"
              className="rounded text-sm text-navy-500 underline-offset-4
                transition-colors duration-150 hover:text-navy-700 hover:underline"
            >
              See all
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="No project yet"
            description="Add the project you are defending, then upload your chapters one by one. Everything after that is built from your own work."
            action={
              <Link href="/projects/new" className={buttonStyles()}>
                Add your project
              </Link>
            }
          />
        ) : (
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
        )}
      </section>
    </div>
  );
}
