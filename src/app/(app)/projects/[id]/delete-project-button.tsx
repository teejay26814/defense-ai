"use client";

import { useRef, useState } from "react";

import { deleteProject } from "../actions";
import { buttonStyles } from "@/components/ui/button";

/**
 * A native <dialog> rather than a hand-rolled overlay - it gives focus trapping, ESC to
 * close, and a real backdrop for free, which is most of what a confirmation modal has to
 * get right for accessibility. Only the visual chrome and the open/submit wiring are ours.
 *
 * The visible button no longer submits the form directly. It opens the dialog; the form
 * still exists (hidden) and the dialog's own "Delete project" button submits it via
 * requestSubmit(), so the server action and its redirect are unchanged - only the moment
 * of commitment moved behind a real question.
 *
 * Deleting removes every document's storage object one call at a time before the row goes,
 * which is not instant - and the confirm button lived outside the form, so useFormStatus
 * could not see it. Without its own pending state the button just sat there for that whole
 * stretch with no sign anything was happening, which read as broken rather than working.
 * isDeleting below is that missing signal: the button disables, spins, and says so, and
 * both Cancel and the backdrop/Escape dismissal are blocked once it is committed - there is
 * no undo past this point, so there is no safe way to back out of it either.
 */
export function DeleteProjectButton({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger
          transition-[background-color,border-color] duration-150
          hover:border-danger hover:bg-danger/8 active:bg-danger/15"
      >
        Delete this project
      </button>

      <form ref={formRef} action={deleteProject} className="hidden">
        <input type="hidden" name="projectId" value={projectId} />
      </form>

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-project-title"
        className="m-auto w-[min(90vw,26rem)] rounded-feature border border-navy-100/70 bg-surface
          p-6 shadow-overlay backdrop:bg-navy-900/50"
        onCancel={(event) => {
          // The Escape key fires this. Once deletion is underway there is nothing left to
          // cancel back out of, so the dialog stops honouring it rather than closing on a
          // request that is already too late to matter.
          if (isDeleting) event.preventDefault();
        }}
        onClick={(event) => {
          // Click on the backdrop (the dialog element itself, outside its content box) closes
          // it - except mid-delete, for the same reason Escape is blocked above.
          if (event.target === event.currentTarget && !isDeleting) dialogRef.current?.close();
        }}
      >
        <h2 id="delete-project-title" className="font-display text-xl text-ink">
          Delete &ldquo;{projectTitle}&rdquo;?
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          This removes the project and every document, question, and mock defense in it.
          There is no undo.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={isDeleting}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-busy={isDeleting}
            disabled={isDeleting}
            onClick={() => {
              setIsDeleting(true);
              formRef.current?.requestSubmit();
            }}
            className={buttonStyles({ variant: "danger", size: "sm" })}
          >
            {isDeleting && (
              <svg aria-hidden viewBox="0 0 20 20" className="size-4 animate-spin">
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeOpacity="0.3"
                />
                <path
                  d="M18 10a8 8 0 0 0-8-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {isDeleting ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </dialog>
    </>
  );
}
