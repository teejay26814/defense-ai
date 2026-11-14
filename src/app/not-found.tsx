import Link from "next/link";
import type { Metadata } from "next";

import { Logo } from "@/components/logo";
import { buttonStyles } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

/** An unknown URL anywhere on the site. */
export default function NotFound() {
  return (
    <main className="field-parchment surface-grain flex min-h-dvh flex-col items-center justify-center px-gutter py-section text-center">
      <Link href="/" aria-label="Academia Scribes home" className="rounded-control text-brand">
        <Logo />
      </Link>
      <p className="figures-display mt-12 font-display text-6xl text-navy-500">404</p>
      <h1 className="mt-4 font-display text-3xl text-ink">This page does not exist</h1>
      <p className="measure mt-3 text-ink-muted">
        The link may be old, or the address mistyped. Nothing you have prepared is lost.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard" className={buttonStyles()}>
          Go to my dashboard
        </Link>
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>
          Home page
        </Link>
      </div>
    </main>
  );
}
