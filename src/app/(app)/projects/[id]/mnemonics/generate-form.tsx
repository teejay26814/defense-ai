"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { generateMnemonics, type MnemonicsState } from "./actions";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { getGenerationJobStatus } from "@/lib/generation-jobs";

const initialState: MnemonicsState = {};

// How often to check on a running job - see the questions GenerateForm for the same choice.
const POLL_INTERVAL_MS = 2500;

export function GenerateMnemonicsForm({
  projectId,
  hasExisting,
}: {
  projectId: string;
  hasExisting: boolean;
}) {
  const [state, formAction] = useActionState(generateMnemonics, initialState);
  const router = useRouter();

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
          error: result.error ?? "The memory aids could not be generated. Please try again.",
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
            text: `${polling.resultCount} memory aid${polling.resultCount === 1 ? "" : "s"} ready.`,
          }
        : generating
          ? { tone: "notice" as const, text: "Looking for the lists in your chapters - this can take up to a minute…" }
          : state.error
            ? { tone: "error" as const, text: state.error }
            : null;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}

      <fieldset disabled={generating}>
        <SubmitButton pendingLabel="Starting…">
          {generating ? "Looking…" : hasExisting ? "Rebuild memory aids" : "Build memory aids"}
        </SubmitButton>
      </fieldset>

      {hasExisting && (
        <p className="text-xs text-ink-muted">
          Rebuilding replaces the current set. Two aids for the same list would work against
          each other.
        </p>
      )}
    </form>
  );
}
