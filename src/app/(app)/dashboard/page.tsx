import Link from "next/link";
import type { Metadata } from "next";

import { buttonStyles } from "@/components/ui/button";
import { ReadinessRing, ReadinessSubmetric } from "@/components/readiness-ring";
import {
  IconBook,
  IconBulb,
  IconChevronRight,
  IconMessage,
  IconShield,
  IconSpark,
  IconUpload,
} from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { CHAPTERS, type DocumentStatus, type Project } from "@/lib/types";

export const metadata: Metadata = { title: "Overview" };

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
 * The readiness figure is the one place this rule is easiest to break by accident, so it is
 * worth restating here: it shows *coverage* (chapters uploaded and indexed) until a real
 * mock defense has been sat, and only shows *readiness* (an actual graded score) after that.
 * The two must never be blurred into one number - a figure claiming "78% ready to defend"
 * before anything has tested the student would be the one lie this product cannot afford.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Neither query depends on the other's result - both only need the session already
  // established above - so they run together rather than as a waterfall.
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    supabase
      .from("projects")
      .select("*, documents(id, chapter, status, word_count)")
      .order("created_at", { ascending: false }),
  ]);

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

  const uploadedChapters = new Set(docs.filter((d) => d.chapter !== null).map((d) => d.chapter));
  const indexedChapters = new Set(
    docs.filter((d) => d.chapter !== null && embeddedDocs.has(d.id)).map((d) => d.chapter),
  );
  const failed = docs.filter((d) => d.status === "failed").length;
  const missing = CHAPTERS.filter((c) => !uploadedChapters.has(c.value));
  const words = docs.reduce((s, d) => s + (d.word_count ?? 0), 0);

  const indexed = indexedChapters.size;
  const coverage = (indexed / CHAPTERS.length) * 100;

  // The counts behind the toolkit and the readiness breakdown. Independent of one another,
  // so fetched together rather than one after another.
  let questionCount = 0;
  let quizReadyCount = 0;
  let reviewedCount = 0;
  let mnemonicCount = 0;
  let sittingCount = 0;
  let readiness: number | null = null;

  if (current) {
    const [questionsRes, quizRes, reviewedRes, mnemonicsRes, sittingsRes, lastSittingRes] =
      await Promise.all([
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("project_id", current.id),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("project_id", current.id)
          .not("options", "is", null),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("project_id", current.id)
          .not("confidence", "is", null),
        supabase
          .from("mnemonics")
          .select("id", { count: "exact", head: true })
          .eq("project_id", current.id),
        supabase
          .from("defense_sessions")
          .select("id", { count: "exact", head: true })
          .eq("project_id", current.id)
          .eq("status", "complete"),
        // The *latest* sitting, not the best one: this figure answers "would you be ready
        // tomorrow", and the highest score a student ever got is not an answer to that.
        supabase
          .from("defense_sessions")
          .select("readiness")
          .eq("project_id", current.id)
          .eq("status", "complete")
          .not("readiness", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    questionCount = questionsRes.count ?? 0;
    quizReadyCount = quizRes.count ?? 0;
    reviewedCount = reviewedRes.count ?? 0;
    mnemonicCount = mnemonicsRes.count ?? 0;
    sittingCount = sittingsRes.count ?? 0;
    readiness = (lastSittingRes.data?.readiness as number | null) ?? null;
  }

  const recallPractice = questionCount > 0 ? (reviewedCount / questionCount) * 100 : null;
  const ringValue = readiness ?? coverage;
  const ringLabel = readiness !== null ? "Ready" : "Indexed";

  // ---- what to do next, as a headline rather than a full-bleed panel -----------------
  const next = !current
    ? {
        eyebrow: "Step 01",
        title: "Add your project",
        body: "Tell us what you are defending, then upload your chapters.",
        href: "/projects/new",
        cta: "Add your project",
        dropzone: true,
      }
    : failed > 0
      ? {
          eyebrow: "Needs attention",
          title: `${failed} document${failed === 1 ? "" : "s"} could not be read`,
          body: "Open the project to see why, and replace or retry them.",
          href: `/projects/${current.id}`,
          cta: "Review documents",
          dropzone: false,
        }
      : docs.length === 0
        ? {
            eyebrow: "Step 02",
            title: "Upload your first chapter",
            body: "Your knowledge base is built from what you upload.",
            href: `/projects/${current.id}`,
            cta: "Upload a chapter",
            dropzone: true,
          }
        : missing.length > 0
          ? {
              eyebrow: "Keep going",
              title: `Upload ${missing[0].label}`,
              body: missing[0].hint,
              href: `/projects/${current.id}`,
              cta: "Continue uploading",
              dropzone: true,
            }
          : {
              eyebrow: "All chapters in",
              title: "Ask your project anything",
              body: `${words.toLocaleString()} words are ready and grounded in your own work.`,
              href: `/projects/${current.id}/ask`,
              cta: "Ask my project",
              dropzone: false,
            };

  const toolkit = current
    ? [
        {
          href: `/projects/${current.id}/ask`,
          title: "Ask",
          body: "Ask anything about your project",
          icon: IconMessage,
          meta: "Grounded in your chapters",
        },
        {
          href: `/projects/${current.id}/questions`,
          title: "Flashcards",
          body: "Review key ideas",
          icon: IconBook,
          meta: `${questionCount} card${questionCount === 1 ? "" : "s"}`,
        },
        {
          href: `/projects/${current.id}/quiz`,
          title: "Quiz",
          body: "Test what you know",
          icon: IconSpark,
          meta: `${quizReadyCount} question${quizReadyCount === 1 ? "" : "s"}`,
        },
        {
          href: `/projects/${current.id}/mnemonics`,
          title: "Mnemonics",
          body: "Make it memorable",
          icon: IconBulb,
          meta: `${mnemonicCount} memory hook${mnemonicCount === 1 ? "" : "s"}`,
        },
        {
          href: `/projects/${current.id}/defense`,
          title: "Defense room",
          body: "Practice the pressure",
          icon: IconShield,
          meta: `${sittingCount} mock round${sittingCount === 1 ? "" : "s"}`,
        },
      ]
    : [];

  return (
    <div className="space-y-10">
      {/* ---- headline: what to do next, plus the next real defense date ---- */}
      <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <span className="label-eyebrow inline-flex items-center gap-2 rounded-full bg-navy-100/70 px-3 py-1.5 text-brand">
            Your defense command centre
          </span>
          <h1 className="measure mt-4 font-display text-4xl leading-[1.1] text-ink sm:text-5xl">
            {firstName ? `Welcome back, ${firstName}.` : "Turn your research into answers you can defend."}
          </h1>
          <p className="measure mt-3 text-ink-muted">{next.body}</p>
        </div>

        <div className="shrink-0 border-t border-navy-100 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
          <p className="label-eyebrow">Your next defense</p>
          <p className="mt-1 font-display text-lg text-ink">
            {current?.defense_date
              ? new Date(current.defense_date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "No date set yet"}
          </p>
          {!current?.defense_date && (
            <p className="text-xs text-ink-muted">
              {current ? "Add one from your project" : "Start with a project"}
            </p>
          )}
        </div>
      </header>

      {/* ---- the next step, and a real stat panel beside it ---- */}
      <section className="grid gap-4 lg:grid-cols-5">
        <Link
          href={next.href}
          className="press group lg:col-span-3 rounded-feature border border-navy-100/70 bg-surface p-7 shadow-raised
            transition-[border-color,box-shadow] hover:border-navy-300 hover:shadow-lifted"
        >
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-navy-050 text-brand">
              {next.dropzone ? (
                <IconUpload className="size-5" />
              ) : (
                <IconMessage className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <span className="label-eyebrow text-navy-500">{next.eyebrow}</span>
              <p className="mt-1 font-display text-xl text-ink">{next.title}</p>
            </div>
          </div>

          {next.dropzone ? (
            <div className="mt-6 rounded-control border border-dashed border-navy-300 bg-navy-050/50 px-6 py-8 text-center">
              <p className="text-sm font-medium text-ink">
                {current ? "Continue uploading your chapters" : "Drop your project details in"}
              </p>
              <p className="mt-1 text-xs text-ink-muted">PDF, Word, or plain text</p>
            </div>
          ) : (
            <p className="measure mt-4 text-sm leading-relaxed text-ink-muted">{next.body}</p>
          )}

          <span
            className={`mt-6 inline-flex ${buttonStyles({ variant: "primary" })}`}
          >
            {next.cta}
          </span>
        </Link>

        <div className="field-navy surface-grain relative overflow-hidden rounded-feature p-7 text-white shadow-lifted lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="label-eyebrow text-white/50">Your study rhythm</p>
            <ReadinessRing value={coverage} size={44} strokeWidth={5} label="" />
          </div>
          <p className="figures-display mt-5 font-sans text-5xl font-semibold text-white">
            {projects.length}
          </p>
          <p className="text-sm text-white/60">
            project{projects.length === 1 ? "" : "s"} in progress
          </p>
          <p className="measure mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/50">
            {current
              ? `${indexed} of ${CHAPTERS.length} chapters indexed and searchable.`
              : "Upload your first project to see your readiness grow."}
          </p>
        </div>
      </section>

      {/* ---- the toolkit ---- */}
      {current && (
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="label-eyebrow">Your toolkit</p>
              <h2 className="mt-1 font-display text-2xl text-ink">Prepare from every angle.</h2>
            </div>
            <Link
              href={`/projects/${current.id}`}
              className="text-sm font-medium text-navy-500 underline-offset-4 transition-colors hover:text-brand hover:underline"
            >
              View project
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toolkit.map((tool) => {
              const locked = !indexedChapters.size;
              const Icon = tool.icon;

              const inner = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-navy-050 text-brand">
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="mt-3">
                    <p className="font-display text-lg text-ink">{tool.title}</p>
                    <p className="text-sm text-ink-muted">{tool.body}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm font-medium text-navy-500">
                    {tool.meta}
                    <IconChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </>
              );

              if (locked) {
                return (
                  <div
                    key={tool.href}
                    aria-disabled="true"
                    title="Upload a chapter and let it finish reading first"
                    className="rounded-surface border border-navy-100/70 bg-surface p-5 opacity-50"
                  >
                    {inner}
                  </div>
                );
              }

              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="press group rounded-surface border border-navy-100/70 bg-surface p-5 shadow-raised
                    transition-[border-color,box-shadow] hover:border-navy-300 hover:shadow-lifted"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- readiness breakdown ---- */}
      {current && (
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-feature border border-navy-100/70 bg-surface p-7 shadow-raised lg:col-span-3">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="label-eyebrow">Readiness map</p>
                <h2 className="mt-1 font-display text-2xl text-ink">A visual path to the panel.</h2>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-start">
              <ReadinessRing value={ringValue} label={ringLabel} />

              <div className="w-full divide-y divide-navy-100">
                <ReadinessSubmetric
                  label="Research map"
                  hint="Your chapters, uploaded and indexed"
                  value={coverage}
                />
                <ReadinessSubmetric
                  label="Recall practice"
                  hint="Questions and cards you have reviewed"
                  value={recallPractice}
                />
                <ReadinessSubmetric
                  label="Panel confidence"
                  hint="Your last mock defense score"
                  value={readiness}
                />
              </div>
            </div>

            {readiness === null && indexedChapters.size > 0 && (
              <Link
                href={`/projects/${current.id}/defense`}
                className={`mt-6 ${buttonStyles({ variant: "secondary", size: "sm" })}`}
              >
                Sit a mock defense
              </Link>
            )}
          </div>

          <div className="rounded-feature border border-navy-100/70 bg-surface p-7 shadow-raised lg:col-span-2">
            <p className="label-eyebrow">The defense lens</p>
            <h2 className="mt-1 font-display text-lg text-ink">What to expect from your workspace.</h2>

            <ul className="mt-4 divide-y divide-navy-100">
              {[
                { title: "Evidence", body: "Every answer is anchored to your own chapters." },
                { title: "Clarity", body: "Complex ideas explained back in plain language." },
                { title: "Composure", body: "Practice under pressure before the real room." },
              ].map((item) => (
                <li key={item.title} className="py-3.5">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---- other projects, if there are any ---- */}
      {projects.length > 1 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="label-eyebrow">Your other projects</p>
            <Link
              href="/projects"
              className="text-sm text-navy-500 underline-offset-4 transition-colors hover:text-brand hover:underline"
            >
              See all
            </Link>
          </div>

          <ul className="border-t border-navy-100">
            {projects.slice(1, 4).map((p) => (
              <li key={p.id} className="rule-hairline">
                <Link
                  href={`/projects/${p.id}`}
                  className="press flex items-baseline gap-5 py-4
                    transition-[background-color,padding] duration-200
                    hover:bg-navy-050/60 hover:px-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg text-ink">{p.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-muted">
                      {p.documents.length} document{p.documents.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <IconChevronRight className="size-4 shrink-0 text-navy-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
