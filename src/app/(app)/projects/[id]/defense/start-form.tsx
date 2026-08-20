"use client";

import { useActionState } from "react";

import { startDefense, type DefenseState } from "./actions";
import { FormMessage, SelectField, SubmitButton } from "@/components/ui/form";
import { DEFENSE_SCOPES } from "@/lib/types";

const initialState: DefenseState = {};

const SCOPE_OPTIONS = DEFENSE_SCOPES.map((s) => ({
  value: s.value,
  label: `${s.label} - ${s.hint}`,
}));

export function StartForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(startDefense, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <SelectField
        label="What are you sitting?"
        name="scope"
        required
        options={SCOPE_OPTIONS}
        defaultValue="final"
        errors={state.fieldErrors?.scope}
      />

      <SubmitButton pendingLabel="Setting up your panel…">Begin</SubmitButton>

      <p className="text-xs text-ink-muted">
        Answer from memory. Looking things up gives you a score you cannot repeat in the
        room.
      </p>
    </form>
  );
}
