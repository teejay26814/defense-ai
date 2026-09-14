"use client";

import { useActionState } from "react";
import Link from "next/link";

import { requestPasswordReset } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function ForgotForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        errors={state.fieldErrors?.email}
      />

      <SubmitButton pendingLabel="Sending the link…">Send reset link</SubmitButton>

      <p className="text-center text-sm text-ink-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="rounded font-medium text-navy-500 underline-offset-4
            transition-colors duration-150 hover:text-brand hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
