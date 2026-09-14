"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signIn } from "../actions";
import { IconChevronRight } from "@/components/icons";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/ui/form";
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

      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
        action={
          <Link
            href="/forgot-password"
            className="rounded text-xs font-medium text-navy-500 underline-offset-4
              transition-colors duration-150 hover:text-brand hover:underline"
          >
            Forgot password?
          </Link>
        }
      />

      <SubmitButton>
        Sign in
        <IconChevronRight className="size-4" />
      </SubmitButton>
    </form>
  );
}
