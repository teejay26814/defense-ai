import Link from "next/link";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Welcome back</h1>
        <p className="mt-2 text-ink-muted">
          Pick up where you left off with your defense preparation.
        </p>
      </header>

      <LoginForm next={typeof next === "string" ? next : undefined} />

      <p className="mt-8 text-center text-sm text-ink-muted">
        New here?{" "}
        <Link
          href="/signup"
          className="rounded font-medium text-navy-500 underline-offset-4
            transition-colors duration-150 hover:text-navy-700 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
