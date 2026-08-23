import Link from "next/link";

import { Logo } from "@/components/logo";

/**
 * Shell for the signed-out screens.
 *
 * Two panels on desktop: the brand field on the left, the form on the right. On mobile
 * the field collapses to a compact header so the form stays above the fold.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <aside className="field-navy surface-grain relative hidden flex-col justify-between p-12 text-white lg:flex">
        <Link
          href="/"
          className="w-fit rounded-lg transition-opacity duration-150 hover:opacity-85"
        >
          <Logo />
        </Link>

        <div className="max-w-md">
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-px w-10 bg-gold" />
            <p className="label-eyebrow text-gold">Defense Coach</p>
          </div>

          <h1 className="mt-7 font-display text-4xl leading-[1.1]">
            If your defense was tomorrow, would you be ready?
          </h1>
          <p className="mt-6 leading-relaxed text-white/65">
            Upload your chapters and Academia Scribes turns them into your own private
            knowledge base, then helps you understand it, remember it, practice it, and
            defend it.
          </p>
        </div>

        {/*
          The reassurance sits at the foot of the brand panel rather than under the form.
          It is the objection a student actually has at this moment - that their unpublished
          work is about to leave their laptop - and it belongs where they are reading, not
          buried beneath a password field.
        */}
        <p className="flex items-start gap-3 text-sm leading-relaxed text-white/50">
          <span aria-hidden className="mt-2 h-px w-6 shrink-0 bg-white/25" />
          <span className="measure-tight">
            Your project stays yours. Nothing you upload is shared with another student.
          </span>
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-6 py-12 sm:px-10">
        <Link href="/" className="mb-10 w-fit text-navy-700 lg:hidden">
          <Logo />
        </Link>
        <div className="animate-rise mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
