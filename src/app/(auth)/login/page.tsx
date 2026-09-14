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

      <header className="mb-6 sm:mb-8">
        <p className="label-eyebrow text-navy-500">Welcome back</p>
        {/*
          text-[1.75rem] on mobile, not text-4xl throughout - at this weight, a flat text-4xl
          (50px) pushed the form below the fold on a phone screen. Desktop keeps the full
          size, since there the two-panel layout has the room for it.
        */}
        <h1 className="mt-2 font-display text-[1.75rem] leading-[1.15] text-ink sm:text-4xl">
          Continue where your prep left off.
        </h1>
        <p className="mt-3 text-ink-muted">
          Sign in to access your projects, study tools, and defense preparation.
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
