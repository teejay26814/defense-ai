"use client";

import { useActionState } from "react";

import {
  Field,
  FormMessage,
  SelectField,
  SubmitButton,
  TextareaField,
} from "@/components/ui/form";
import { DEGREE_LABELS, type Project } from "@/lib/types";
import type { ActionState } from "@/lib/validation/project";

const initialState: ActionState = {};

const DEGREE_OPTIONS = Object.entries(DEGREE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function ProjectForm({
  action,
  project,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  project?: Project;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {project && <input type="hidden" name="projectId" value={project.id} />}

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}

      <Field
        label="Project title"
        name="title"
        required
        defaultValue={project?.title}
        hint="The title on your cover page."
        errors={state.fieldErrors?.title}
      />

      <TextareaField
        label="What is it about?"
        name="topic"
        rows={3}
        defaultValue={project?.topic ?? undefined}
        placeholder="A sentence or two in your own words."
        hint="This helps the coach frame questions the way your panel would."
        errors={state.fieldErrors?.topic}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Level"
          name="degreeLevel"
          placeholder="Select…"
          options={DEGREE_OPTIONS}
          defaultValue={project?.degree_level ?? undefined}
          errors={state.fieldErrors?.degreeLevel}
        />
        <Field
          label="Defense date"
          name="defenseDate"
          type="date"
          defaultValue={project?.defense_date ?? undefined}
          errors={state.fieldErrors?.defenseDate}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Institution"
          name="institution"
          defaultValue={project?.institution ?? undefined}
          errors={state.fieldErrors?.institution}
        />
        <Field
          label="Department"
          name="department"
          defaultValue={project?.department ?? undefined}
          errors={state.fieldErrors?.department}
        />
      </div>

      <Field
        label="Supervisor"
        name="supervisor"
        defaultValue={project?.supervisor ?? undefined}
        errors={state.fieldErrors?.supervisor}
      />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
