"use client";

import { useActionState } from "react";

import { generateQuestions, type QuestionsState } from "./actions";
import { FormMessage, SelectField, SubmitButton } from "@/components/ui/form";
import { DEFENSE_SCOPES } from "@/lib/types";

const initialState: QuestionsState = {};

const SCOPE_OPTIONS = DEFENSE_SCOPES.map((s) => ({
  value: s.value,
  label: `${s.label} - ${s.hint}`,
}));

const COUNT_OPTIONS = [6, 12, 20].map((n) => ({
  value: String(n),
  label: `${n} questions`,
}));

export function GenerateForm({
  projectId,
  defaultScope,
}: {
  projectId: string;
  /** Preselected from what is actually indexed, so the common case is one click. */
  defaultScope: string;
}) {
  const [state, formAction] = useActionState(generateQuestions, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="What are you preparing for?"
          name="scope"
          required
          options={SCOPE_OPTIONS}
          defaultValue={defaultScope}
          errors={state.fieldErrors?.scope}
        />
        <SelectField
          label="How many"
          name="count"
          required
          options={COUNT_OPTIONS}
          defaultValue="12"
          errors={state.fieldErrors?.count}
        />
      </div>

      <SubmitButton pendingLabel="Reading your chapters and writing questions…">
        Generate questions
      </SubmitButton>

      <p className="text-xs text-ink-muted">
        Takes up to a minute. Questions are written only from what you have uploaded, so
        nothing here is general knowledge.
      </p>
    </form>
  );
}
