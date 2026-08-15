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
          <h1 className="font-display text-4xl leading-tight">
            If your defense was tomorrow, would you be ready?
          </h1>
          <p className="mt-5 text-white/70">
            Upload your chapters and Academia Scribes turns them into your own private
            knowledge base — then helps you understand it, remember it, practise it, and
            defend it.
          </p>
        </div>

        <p className="text-sm text-white/50">
          Your project stays yours. Nothing you upload is shared with another student.
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col justify-center px-6 py-12 sm:px-10">
        <Link href="/" className="mb-10 w-fit text-navy-700 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
