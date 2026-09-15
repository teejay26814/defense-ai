"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { generateQuestions, getGenerationJobStatus, type QuestionsState } from "./actions";
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

// How often to check on a running job. Frequent enough to feel responsive, far apart
// enough that a minute of generation is a couple dozen small reads, not a flood.
const POLL_INTERVAL_MS = 2500;

export function GenerateForm({
  projectId,
  defaultScope,
}: {
  projectId: string;
  /** Preselected from what is actually indexed, so the common case is one click. */
  defaultScope: string;
}) {
  const [state, formAction] = useActionState(generateQuestions, initialState);
  const router = useRouter();

  // Generation itself runs in a Netlify Background Function, not inside this request - the
  // action returns almost immediately once the job is started, so this component polls the
  // job row for the result rather than the form's own pending state reflecting it.
  type PollState = { jobId: string; status: "pending" | "succeeded" | "failed"; error?: string; resultCount?: number };
  const [polling, setPolling] = useState<PollState | null>(null);
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.jobId && state.jobId !== jobIdRef.current) {
      jobIdRef.current = state.jobId;
      setPolling({ jobId: state.jobId, status: "pending" });
    }
  }, [state.jobId]);

  useEffect(() => {
    if (!polling || polling.status !== "pending") return;

    let cancelled = false;
    const timer = setInterval(async () => {
      const result = await getGenerationJobStatus(polling.jobId);
      if (cancelled || !result) return;

      if (result.status === "succeeded") {
        setPolling({ jobId: polling.jobId, status: "succeeded", resultCount: result.resultCount ?? 0 });
        router.refresh();
      } else if (result.status === "failed") {
        setPolling({
          jobId: polling.jobId,
          status: "failed",
          error: result.error ?? "The questions could not be generated. Please try again.",
        });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [polling, router]);

  const generating = polling?.status === "pending";
  const message =
    polling?.status === "failed"
      ? { tone: "error" as const, text: polling.error! }
      : polling?.status === "succeeded"
        ? {
            tone: "notice" as const,
            text: `${polling.resultCount} question${polling.resultCount === 1 ? "" : "s"} ready.`,
          }
        : generating
          ? { tone: "notice" as const, text: "Generating your questions - this can take up to a minute…" }
          : state.error
            ? { tone: "error" as const, text: state.error }
            : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}

      <fieldset disabled={generating} className="space-y-4">
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

        <SubmitButton pendingLabel="Starting…">
          {generating ? "Generating…" : "Generate questions"}
        </SubmitButton>
      </fieldset>

      <p className="text-xs text-ink-muted">
        Takes up to a minute. Questions are written only from what you have uploaded, so
        nothing here is general knowledge.
      </p>
    </form>
  );
}
