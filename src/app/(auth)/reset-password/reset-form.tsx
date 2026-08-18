"use client";

import { useActionState } from "react";

import { resetPassword } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function ResetForm() {
  const [state, formAction] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field
        label="New password"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      />

      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        required
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pendingLabel="Saving your new password…">Set new password</SubmitButton>
    </form>
  );
}
