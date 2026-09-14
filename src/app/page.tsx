import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

const STEPS = [
  {
    title: "Understand",
    body: "Ask anything about your own project and get an answer grounded in your chapters, with the source it came from.",
  },
  {
    title: "Remember",
    body: "Flashcards and quizzes built from your actual work - not generic study material.",
  },
  {
    title: "Practice",
    body: "Face the questions your panel is most likely to ask, and rehearse until the answers are yours.",
  },
  {
    title: "Defend",
    body: "A mock defense that scores your readiness and shows you exactly where you are still weak.",
  },
];

export default async function Home() {
  // The landing page is public, but a signed-in student should see a route into the app
  // rather than a "Sign in" button they do not need.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo className="text-brand" />
        <nav className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle className="text-ink-muted hover:bg-navy-050 hover:text-ink" />
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white shadow-lifted
                transition-[transform,background-color] duration-150
                hover:bg-navy-600 active:translate-y-px"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink
                  transition-colors duration-150 hover:bg-navy-050 active:bg-navy-100"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white shadow-lifted
                  transition-[transform,background-color] duration-150
                  hover:bg-navy-600 active:translate-y-px"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="field-parchment surface-grain">
          <div className="mx-auto max-w-6xl px-6 py-section">
            {/*
              A rule and an eyebrow before the headline. It costs one line and it is most of
              what separates an editorial opening from a landing-page template: the reader is
              told what kind of thing this is before being asked to read the big type.
            */}
            <div className="animate-fade flex items-center gap-4">
              <span aria-hidden className="h-px w-12 bg-navy-500" />
              <p className="label-eyebrow">For final-year students</p>
            </div>

            <h1 className="animate-rise mt-7 max-w-[16ch] font-display text-4xl text-ink sm:text-5xl lg:text-6xl">
              If your defense was tomorrow, would you be ready?
            </h1>

            <p className="animate-rise measure mt-7 text-xl leading-relaxed text-ink/75">
              Academia Scribes turns your final-year project into a private coach. Upload
              your chapters and prepare against your own work, not a generic study guide.
            </p>

            <div className="animate-rise mt-10 flex flex-wrap items-center gap-3">
              <Link
                href={user ? "/dashboard" : "/signup"}
                className={buttonStyles({ size: "lg" })}
              >
                {user ? "Go to dashboard" : "Start preparing"}
              </Link>
              {!user && (
                <Link
                  href="/login"
                  className={buttonStyles({ variant: "secondary", size: "lg" })}
                >
                  I already have an account
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-section">
          <h2 className="label-eyebrow">Four things, done properly</h2>
          {/*
            A ruled index rather than four cards, matching the dashboard. The figures are the
            structure: a reader scans 01 to 04 and understands the sequence before reading a
            word of it, which four equally weighted boxes never achieve.
          */}
          <ul className="mt-10 grid border-t border-navy-100 sm:grid-cols-2 sm:gap-x-16">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rule-hairline py-8">
                <div className="flex items-baseline gap-5">
                  <span className="figures-data label-eyebrow shrink-0 text-navy-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl text-ink">{step.title}</h3>
                    <p className="measure mt-2 leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="field-navy surface-grain text-white">
          <div className="mx-auto max-w-5xl px-6 py-section">
            <h2 className="max-w-2xl font-display text-3xl leading-tight">
              Your project stays yours.
            </h2>
            <p className="mt-4 max-w-xl text-white/70">
              Every project is an isolated knowledge base. No student can reach another
              student&apos;s work - that is enforced in the database, not just the app.
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-10 text-sm text-ink-muted">
        <Logo className="text-brand" markClassName="h-6 w-auto" />
        <p>© {new Date().getFullYear()} Academia Scribes</p>
      </footer>
    </div>
  );
}
