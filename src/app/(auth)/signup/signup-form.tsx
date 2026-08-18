"use client";

import { useActionState } from "react";

import { signUp } from "../actions";
import { Field, FormMessage, SubmitButton } from "@/components/ui/form";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: AuthFormState = {};

export function SignupForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signUp, initialState);

  // Once the confirmation notice is showing, the form has done its job - leaving the
  // fields up invites a second submission that would only error.
  if (state.notice) {
    return <FormMessage tone="notice">{state.notice}</FormMessage>;
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <Field
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        errors={state.fieldErrors?.fullName}
      />

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
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      />

      <Field
        label="Institution"
        name="institution"
        autoComplete="organization"
        errors={state.fieldErrors?.institution}
      />

      <Field
        label="Department"
        name="department"
        errors={state.fieldErrors?.department}
      />

      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}
