"use client";

import { useActionState } from "react";

import { signUp } from "../actions";
import { IconChevronRight } from "@/components/icons";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/ui/form";
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

      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        errors={state.fieldErrors?.password}
      />

      <PasswordField
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />

      {/*
        Institution and department dropped from signup on purpose - they are asked again,
        per project, on the "Add your project" form (project-form.tsx), which is the more
        useful place for them anyway: a student can attend more than one institution across
        different projects, and a value fixed at signup would just go stale. Fewer fields
        here means less friction between "I want to try this" and an actual account.
      */}

      <SubmitButton>
        Create account
        <IconChevronRight className="size-4" />
      </SubmitButton>
    </form>
  );
}
