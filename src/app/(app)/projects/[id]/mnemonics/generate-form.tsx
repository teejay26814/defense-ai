"use client";

import { useActionState } from "react";

import { generateMnemonics, type MnemonicsState } from "./actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";

const initialState: MnemonicsState = {};

export function GenerateMnemonicsForm({
  projectId,
  hasExisting,
}: {
  projectId: string;
  hasExisting: boolean;
}) {
  const [state, formAction] = useActionState(generateMnemonics, initialState);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <SubmitButton pendingLabel="Looking for the lists in your chapters…">
        {hasExisting ? "Rebuild memory aids" : "Build memory aids"}
      </SubmitButton>

      {hasExisting && (
        <p className="text-xs text-ink-muted">
          Rebuilding replaces the current set. Two aids for the same list would work against
          each other.
        </p>
      )}
    </form>
  );
}
