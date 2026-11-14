"use client";

import { ErrorPanel } from "@/components/boundaries/error-panel";

/** Errors outside the signed-in app (the landing page, auth screens, a failing app shell). */
export default function RootError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="field-parchment surface-grain flex min-h-dvh items-center px-gutter py-section">
      <ErrorPanel {...props} homeHref="/" homeLabel="Go to the home page" />
    </main>
  );
}
