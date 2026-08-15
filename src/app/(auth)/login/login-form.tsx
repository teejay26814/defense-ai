"use client";

import { useActionState } from "react";

import { signIn } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        errors={state.fieldErrors?.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />

      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
