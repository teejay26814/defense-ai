import Link from "next/link";

import { IconBook, IconShield, IconSpark } from "@/components/icons";
import { Logo } from "@/components/logo";

const FEATURES = [
  { icon: IconBook, label: "Your project" },
  { icon: IconShield, label: "Private space" },
  { icon: IconSpark, label: "Panel ready" },
];

/**
 * Shell for the signed-out screens.
 *
 * Two panels on desktop: the brand field on the left, the form on the right. On mobile
 * the field collapses to a compact header so the form stays above the fold.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="field-navy surface-grain relative hidden flex-col justify-between gap-10 overflow-hidden px-12 py-10 text-white lg:flex xl:px-14 xl:py-12">
        {/*
          Two concentric rings, off-centre behind the headline - an orbit, not a target. Pure
          decoration, so it is aria-hidden and drawn with currentColor at low opacity rather
          than a fixed colour, which is what keeps it this quiet against the gradient.
        */}
        <svg
          aria-hidden
          viewBox="0 0 420 420"
          className="pointer-events-none absolute -right-32 top-1/4 size-[420px] -translate-y-1/4 text-white/[0.07]"
        >
          <circle cx="210" cy="210" r="209" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="210" cy="210" r="148" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>

        <Link
          href="/"
          className="relative w-fit rounded-lg transition-opacity duration-150 hover:opacity-85"
        >
          <Logo />
        </Link>

        <div className="relative max-w-md">
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-px w-10 bg-navy-500" />
            <p className="label-eyebrow text-navy-500">Private academic workspace</p>
          </div>

          <h1 className="mt-6 font-display text-[2.125rem] leading-[1.12] xl:text-4xl">
            Walk into your defense with clarity.
          </h1>
          <p className="mt-5 leading-relaxed text-white/65">
            Upload your chapters and Academia Scribes turns them into your own private
            knowledge base, then helps you understand it, remember it, practice it, and
            defend it.
          </p>

          {/*
            Three of what the workspace actually does, not three abstract adjectives - the
            reference this was modelled on used feature-shaped nouns here rather than a
            second paragraph, and that reads faster on a screen a student glances at once
            before typing a password.
          */}
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-white/75">
                <Icon className="size-[18px] shrink-0 text-navy-500" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="label-eyebrow text-white/35">Prepare deeply · defend confidently</p>
      </aside>

      <main className="field-grid relative flex min-h-dvh flex-col justify-start px-6 py-8 sm:px-10 sm:py-12 lg:justify-center">
        <Link href="/" className="relative mb-6 w-fit text-brand sm:mb-10 lg:hidden">
          <Logo />
        </Link>
        {/*
          max-w-md, not max-w-sm: at this type scale's text-4xl, a 384px column wraps a
          headline like "Continue where your prep left off." into three ragged lines
          ("Continue" / "where your" / "prep left off.") instead of two balanced ones. Every
          other text-4xl heading in the app sits in a much wider column, so the fix is more
          room here rather than a smaller, inconsistent font size just for auth.
        */}
        <div className="animate-rise relative mx-auto w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
