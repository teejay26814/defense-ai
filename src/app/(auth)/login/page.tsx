import type { Metadata } from "next";

import { IconShield } from "@/components/icons";
import { AuthTabs } from "../auth-tabs";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <>
      <AuthTabs active="signin" />

      <header className="mb-8">
        <p className="label-eyebrow text-navy-500">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl text-ink">
          Continue where your prep left off.
        </h1>
        <p className="mt-3 text-ink-muted">
          Sign in to open your projects and pick up your preparation.
        </p>
      </header>

      <LoginForm next={typeof next === "string" ? next : undefined} />

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-muted">
        <IconShield className="size-4 shrink-0" />
        Your work stays private and protected.
      </p>
    </>
  );
}
