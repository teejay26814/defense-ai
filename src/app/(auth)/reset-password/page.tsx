import Link from "next/link";
import type { Metadata } from "next";

import { ResetForm } from "./reset-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set a new password" };

/**
 * Reachable only with the session the recovery link establishes through /auth/confirm.
 *
 * A student who lands here without one - an expired link, a bookmark, a second click on a
 * single-use link - is told what happened and given the way back, rather than shown a form
 * that would fail on submit.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <header className="mb-6">
          <p className="label-eyebrow">Account recovery</p>
          <h1 className="mt-2 font-display text-4xl text-ink">That link has expired</h1>
          <p className="mt-2 text-ink-muted">
            Reset links can only be used once, and they run out after an hour. Ask for a
            fresh one and it will work.
          </p>
        </header>

        <Link
          href="/forgot-password"
          className="rounded font-medium text-navy-500 underline-offset-4
            transition-colors duration-150 hover:text-brand hover:underline"
        >
          Send me a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <header className="mb-8">
        <p className="label-eyebrow">Account recovery</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Set a new password</h1>
        <p className="mt-2 text-ink-muted">
          Choose something you will remember. You will stay signed in afterwards.
        </p>
      </header>

      <ResetForm />
    </>
  );
}
