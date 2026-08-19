import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/logo";
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
    title: "Practise",
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
        <Logo className="text-navy-700" />
        <nav className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white shadow-elevated
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
                className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white shadow-elevated
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
          <div className="mx-auto max-w-5xl px-6 pb-12 pt-section">
            <h1 className="max-w-3xl font-display text-4xl leading-[1.1] text-ink sm:text-5xl lg:text-6xl">
              If your defense was tomorrow, would you be ready?
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-muted">
              Academia Scribes turns your final-year project into a private coach. Upload
              your chapters and prepare against your own work - not a generic study guide.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="rounded-lg bg-navy-700 px-5 py-3 font-medium text-white shadow-floating
                  transition-[transform,background-color] duration-150
                  hover:bg-navy-600 active:translate-y-px"
              >
                {user ? "Go to dashboard" : "Start preparing"}
              </Link>
              {!user && (
                <Link
                  href="/login"
                  className="rounded-lg border border-navy-300 px-5 py-3 font-medium text-navy-700
                    transition-[background-color,border-color] duration-150
                    hover:border-navy-500 hover:bg-white active:bg-navy-050"
                >
                  I already have an account
                </Link>
              )}
            </div>
          </div>

          {/*
            The room, empty, the evening before. It answers the headline rather than
            decorating it: this is what the student is walking into, and the thesis is
            already on the lectern waiting for them.

            Treated per the design guardrails - a parchment gradient washes the top edge so
            the photograph emerges from the section rather than being pasted onto it, and a
            navy multiply layer pulls its warmth back towards the brand. priority, because
            it is the largest thing above the fold and a late-loading hero is a visible
            lurch.
          */}
          <div className="relative mt-4 h-[38vw] max-h-[26rem] min-h-[13rem] w-full overflow-hidden">
            <Image
              src="/hero/defense-room.png"
              alt="An empty university defense room in late afternoon light, a bound thesis resting closed on the lectern"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-navy-800/25 mix-blend-multiply"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-parchment to-transparent"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-parchment to-transparent"
            />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-section">
          <h2 className="font-display text-2xl text-ink">Four things, done properly</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="rounded-xl border border-navy-100 bg-white/70 p-6 shadow-base
                  transition-[transform,box-shadow] duration-200
                  hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <span className="font-display text-sm text-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 font-display text-xl text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
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
        <Logo className="text-navy-700" markClassName="h-6 w-auto" />
        <p>© {new Date().getFullYear()} Academia Scribes</p>
      </footer>
    </div>
  );
}
