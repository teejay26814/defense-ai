import Link from "next/link";
import type { Metadata } from "next";

import { buttonStyles } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ReadinessRing } from "@/components/readiness-ring";
import { ThemeToggle } from "@/components/theme-toggle";
import { PLANS, PRICES_KOBO, type Plan } from "@/lib/plans";

/**
 * The public landing page.
 *
 * Fully static on purpose. It used to call getUser() to swap "Sign in" for "Go to
 * dashboard", which made every visit - including every visitor who has never signed up - a
 * server render plus a round-trip to Supabase Auth. Now it is prerendered once at build and
 * served from the CDN edge.
 *
 * A signed-in student loses nothing: /login and /signup are signed-out-only routes in
 * src/proxy.ts, so either button sends them straight to their dashboard.
 */
export const dynamic = "force-static";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const PILLARS = [
  {
    title: "Understand",
    body: "Ask anything about your own project and get an answer grounded in your chapters, with the source it came from.",
  },
  {
    title: "Remember",
    body: "Flashcards, quizzes and memory aids built from your actual work - not generic study material.",
  },
  {
    title: "Practice",
    body: "Face the questions your panel is most likely to ask, and rehearse until the answers are yours.",
  },
  {
    title: "Defend",
    body: "A mock defense that marks your answers, scores your readiness and shows you where you are still weak.",
  },
];

const STEPS = [
  {
    title: "Upload your chapters",
    body: "PDF, Word or text. Upload the whole project in one file and we split it into chapters for you.",
  },
  {
    title: "We build your knowledge base",
    body: "Your project is read and indexed privately - only you can ever reach it.",
  },
  {
    title: "Prepare until you are ready",
    body: "Ask, drill, quiz and sit mock defenses. Your readiness score tells you when to stop.",
  },
];

const naira = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);

type Tier = {
  plan: Plan;
  price: string;
  term: string;
  points: string[];
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    plan: "free",
    price: naira(0),
    term: "no card needed",
    points: [
      `${PLANS.free.chapters} chapter indexed`,
      `${PLANS.free.answer} questions to your project`,
      `${PLANS.free.questions} examiner question sets`,
      "See it work on your own chapter",
    ],
  },
  {
    plan: "proposal",
    price: naira(PRICES_KOBO.proposal),
    term: `one payment · ${PLANS.proposal.days} days`,
    points: [
      `Chapters 1 to ${PLANS.proposal.chapters}`,
      "Unlimited asks, flashcards and quizzes",
      "Unlimited memory aids",
      "Mock defense with a readiness score",
    ],
  },
  {
    plan: "full",
    price: naira(PRICES_KOBO.full),
    term: `one payment · ${PLANS.full.days} days`,
    featured: true,
    points: [
      `All ${PLANS.full.chapters} chapters`,
      `Up to ${PLANS.full.projects} projects`,
      "Unlimited asks, flashcards and quizzes",
      "Unlimited mock defenses",
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50
          focus-visible:rounded-control focus-visible:bg-surface focus-visible:px-4 focus-visible:py-2 focus-visible:shadow-lifted"
      >
        Skip to content
      </a>

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-gutter py-5">
        <Link
          href="/"
          aria-label="Academia Scribes home"
          className="rounded-control text-brand transition-opacity duration-150 hover:opacity-85 active:opacity-70"
        >
          <Logo markClassName="h-8 w-auto sm:h-9" />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle className="text-ink-muted hover:bg-navy-050 hover:text-ink" />
          <Link
            href="/login"
            className="rounded-control px-3 py-2 text-sm font-medium text-ink
              transition-colors duration-150 hover:bg-navy-050 active:bg-navy-100"
          >
            Sign in
          </Link>
          <Link href="/signup" className={`${buttonStyles({ size: "sm" })} hidden sm:inline-flex`}>
            Get started
          </Link>
        </nav>
      </header>

      <main id="main">
        {/* --- hero --- */}
        <section className="field-parchment surface-grain overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-gutter py-section lg:grid-cols-[1.15fr_1fr] lg:py-section-lg">
            <div>
              <div className="animate-fade flex items-center gap-4">
                <span aria-hidden className="h-px w-12 bg-navy-500" />
                <p className="label-eyebrow">For final-year students</p>
              </div>

              <h1 className="animate-rise mt-7 max-w-[16ch] font-display text-4xl text-ink sm:text-5xl lg:text-6xl">
                If your defense was tomorrow, would you be ready?
              </h1>

              <p className="animate-rise measure mt-7 text-lg leading-relaxed text-ink/75 sm:text-xl">
                Academia Scribes turns your final-year project into a private coach. Upload
                your chapters and prepare against your own work, not a generic study guide.
              </p>

              <div className="animate-rise mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link href="/signup" className={buttonStyles({ size: "lg" })}>
                  Start preparing - it&apos;s free
                </Link>
                <Link
                  href="/login"
                  className={buttonStyles({ variant: "secondary", size: "lg" })}
                >
                  I already have an account
                </Link>
              </div>

              <p className="animate-fade mt-5 text-sm text-ink-muted">
                Free to start. No card. Your first chapter is indexed in minutes.
              </p>
            </div>

            <HeroPreview />
          </div>
        </section>

        {/* --- the four pillars --- */}
        <section aria-labelledby="pillars" className="mx-auto max-w-6xl px-gutter py-section">
          <h2 id="pillars" className="label-eyebrow">
            Four things, done properly
          </h2>
          <ul className="mt-10 grid border-t border-navy-100 sm:grid-cols-2 sm:gap-x-16">
            {PILLARS.map((pillar, i) => (
              <li key={pillar.title} className="rule-hairline py-8">
                <div className="flex items-baseline gap-5">
                  <span className="figures-data label-eyebrow shrink-0 text-navy-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl text-ink">{pillar.title}</h3>
                    <p className="measure mt-2 leading-relaxed text-ink-muted">{pillar.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* --- how it works --- */}
        <section aria-labelledby="how" className="bg-canvas">
          <div className="mx-auto max-w-6xl px-gutter py-section">
            <p className="label-eyebrow">How it works</p>
            <h2 id="how" className="mt-3 max-w-[22ch] font-display text-3xl text-ink sm:text-4xl">
              From chapters to confident in three steps.
            </h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="rounded-surface bg-surface p-6 shadow-raised"
                >
                  <span
                    aria-hidden
                    className="figures-data flex size-10 items-center justify-center rounded-full bg-navy-700 font-display text-base font-semibold text-white"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-display text-xl text-ink">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --- pricing --- */}
        <section aria-labelledby="pricing" className="mx-auto max-w-6xl px-gutter py-section">
          <p className="label-eyebrow">Pricing</p>
          <h2 id="pricing" className="mt-3 font-display text-3xl text-ink sm:text-4xl">
            You defend once, so you pay once.
          </h2>
          <p className="measure mt-4 text-ink-muted">
            No subscription to remember to cancel. Pick the window that covers your
            preparation.
          </p>

          <ul className="mt-12 grid gap-5 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <li
                key={tier.plan}
                className={`flex flex-col rounded-surface p-7 ${
                  tier.featured
                    ? "bloom bg-surface shadow-lifted ring-2 ring-navy-500"
                    : "bg-surface shadow-raised"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl text-ink">{PLANS[tier.plan].label}</h3>
                  {tier.featured && (
                    <span className="label-eyebrow text-navy-500">Most complete</span>
                  )}
                </div>
                <p className="figures-display mt-5 font-sans text-4xl font-semibold text-ink">
                  {tier.price}
                </p>
                <p className="label-eyebrow mt-2">{tier.term}</p>
                <ul className="mt-6 flex-1 space-y-2.5 border-t border-navy-100 pt-5 text-sm text-ink-muted">
                  {tier.points.map((point) => (
                    <li key={point} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-navy-500" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`${buttonStyles({
                    variant: tier.featured ? "primary" : "secondary",
                    full: true,
                  })} mt-7`}
                >
                  {tier.plan === "free" ? "Start free" : "Start free, upgrade anytime"}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ink-muted">
            Payments are handled securely by Paystack. Card details never reach this app.
          </p>
        </section>

        {/* --- privacy + closing call to action --- */}
        <section className="field-navy surface-grain text-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-gutter py-section lg:grid-cols-2 lg:items-end">
            <div>
              <h2 className="max-w-[18ch] font-display text-3xl leading-tight sm:text-4xl">
                Your project stays yours.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-white/70">
                Every project is an isolated knowledge base. No student can reach another
                student&apos;s work - that is enforced in the database, not just the app.
              </p>
            </div>
            <div className="lg:justify-self-end">
              <p className="font-display text-xl text-white/90">
                Your panel will not wait. Start tonight.
              </p>
              <Link
                href="/signup"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-control bg-white px-6 py-3.5 text-base font-medium text-navy-700
                  shadow-lifted transition-[transform,background-color] duration-150
                  hover:bg-navy-050 active:scale-[0.98]"
              >
                Create my free account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-gutter py-10 text-sm text-ink-muted">
        <Logo className="text-brand" markClassName="h-6 w-auto" />
        <p>© {new Date().getFullYear()} Academia Scribes</p>
      </footer>
    </div>
  );
}

/**
 * What the product actually looks like, before anyone has to sign up for it: an examiner
 * question cited back to a chapter, and the readiness ring from the dashboard.
 *
 * Marked as an example in plain text - this is illustration, not a claim about anyone's
 * real score. Purely presentational and server-rendered, so it costs no JavaScript.
 */
function HeroPreview() {
  return (
    <div aria-hidden className="animate-scale-in relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="rounded-feature bg-surface p-6 shadow-overlay sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="label-eyebrow">Mock defense · Example</p>
          <span className="rounded-full bg-navy-050 px-2.5 py-1 text-xs font-medium text-brand">
            Chapter 3 · Methodology
          </span>
        </div>
        <p className="mt-5 font-display text-xl leading-snug text-ink sm:text-2xl">
          &ldquo;Why did you choose purposive sampling over a random sample for this
          study?&rdquo;
        </p>
        <div className="mt-6 space-y-2.5">
          <div className="h-2.5 w-full rounded-full bg-navy-100/80" />
          <div className="h-2.5 w-11/12 rounded-full bg-navy-100/80" />
          <div className="h-2.5 w-3/5 rounded-full bg-navy-100/80" />
        </div>
        <div className="mt-7 flex items-center gap-5 border-t border-navy-100 pt-6">
          <ReadinessRing value={78} size={88} strokeWidth={9} label="Ready" />
          <div className="min-w-0">
            <p className="font-display text-lg text-ink">Strong answer</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Cite your population size from 3.2 to make it airtight.
            </p>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden rounded-surface bg-navy-700 px-4 py-3 text-sm text-white shadow-lifted sm:block">
        <span className="font-semibold">42</span> flashcards ready
      </div>
    </div>
  );
}
