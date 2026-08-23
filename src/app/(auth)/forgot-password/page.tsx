import type { Metadata } from "next";

import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <header className="mb-8">
        <p className="label-eyebrow">Account recovery</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Reset your password</h1>
        <p className="mt-3 text-ink-muted">
          Enter the email you signed up with and we will send you a link to set a new
          password.
        </p>
      </header>

      <ForgotForm />
    </>
  );
}
