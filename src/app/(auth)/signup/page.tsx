import Link from "next/link";
import type { Metadata } from "next";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;

  return (
    <>
      <header className="mb-8">
        <p className="label-eyebrow">Create an account</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Start preparing</h1>
        <p className="mt-2 text-ink-muted">
          Create your account, then upload your project and we will build your defense
          coach around it.
        </p>
      </header>

      <SignupForm next={typeof next === "string" ? next : undefined} />

      <p className="mt-8 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-navy-500 underline-offset-4
            transition-colors duration-150 hover:text-navy-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
