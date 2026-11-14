"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonStyles } from "@/components/ui/button";

/**
 * The fallback a student sees when a screen fails to render.
 *
 * Almost every failure here is transient - a slow Supabase response, a dropped mobile
 * connection - so the primary action is a retry, which re-fetches the server components
 * rather than just re-rendering stale state. The digest is shown so a student reporting a
 * problem can give us something that matches the server log; the message itself never is,
 * since in production Next replaces server error messages with a generic one anyway.
 */
export function ErrorPanel({
  error,
  retry,
  homeHref = "/dashboard",
  homeLabel = "Back to overview",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error("[boundary]", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="animate-rise mx-auto max-w-lg rounded-surface bg-surface px-6 py-12 text-center shadow-raised sm:px-10"
    >
      <p className="label-eyebrow">Something went wrong</p>
      <h1 className="mt-3 font-display text-2xl text-ink">
        This page did not load properly
      </h1>
      <p className="mx-auto mt-3 max-w-prose leading-relaxed text-ink-muted">
        It is usually a brief connection problem. Your work is saved - try again, and if it
        keeps happening, come back in a few minutes.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" onClick={() => retry()} className={buttonStyles()}>
          Try again
        </button>
        <Link href={homeHref} className={buttonStyles({ variant: "secondary" })}>
          {homeLabel}
        </Link>
      </div>
      {error.digest && (
        <p className="figures-data mt-6 text-xs text-ink-muted">Reference: {error.digest}</p>
      )}
    </div>
  );
}
