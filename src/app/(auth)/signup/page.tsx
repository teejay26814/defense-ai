import type { Metadata } from "next";

import { IconShield } from "@/components/icons";
import { AuthTabs } from "../auth-tabs";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;

  return (
    <>
      <AuthTabs active="signup" />

      <header className="mb-6 sm:mb-8">
        <p className="label-eyebrow text-navy-500">Begin your preparation</p>
        <h1 className="mt-2 font-display text-[1.75rem] leading-[1.15] text-ink sm:text-4xl">
          Create your defense workspace.
        </h1>
        <p className="mt-2 text-ink-muted">
          One focused place for your project, study tools, and defense practice.
        </p>
      </header>

      <SignupForm next={typeof next === "string" ? next : undefined} />

      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-ink-muted">
        <IconShield className="size-4 shrink-0" />
        Your work stays private and protected.
      </p>
    </>
  );
}
