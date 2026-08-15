"use client";

import { useActionState, useEffect, useRef } from "react";

import { uploadDocument } from "../actions";
import {
  Field,
  FileField,
  FormMessage,
  SelectField,
  SubmitButton,
} from "@/components/ui/form";
import { CHAPTERS, MAX_FILE_BYTES, formatBytes } from "@/lib/types";
import type { ActionState } from "@/lib/validation/project";

const initialState: ActionState = {};

const CHAPTER_OPTIONS = CHAPTERS.map((c) => ({
  value: String(c.value),
  label: `${c.label} — ${c.hint}`,
}));

export function UploadForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(uploadDocument, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful upload so the file input does not still show the
  // last file, which reads as though it failed to submit.
  useEffect(() => {
    if (state.notice) formRef.current?.reset();
  }, [state.notice]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Chapter"
          name="chapter"
          placeholder="Not a numbered chapter"
          options={CHAPTER_OPTIONS}
        />
        <Field
          label="Label"
          name="label"
          required
          hint="How you refer to it."
          errors={state.fieldErrors?.label}
        />
      </div>

      <FileField
        label="File"
        name="file"
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        hint={`PDF, Word (.docx), or plain text. Up to ${formatBytes(MAX_FILE_BYTES)}.`}
        errors={state.fieldErrors?.file}
      />

      <SubmitButton>Upload and read</SubmitButton>

      <p className="text-xs text-ink-muted">
        Scanned PDFs will not work — the text in them is an image. Export from your word
        processor instead.
      </p>
    </form>
  );
}
