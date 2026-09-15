"use client";

import { useRef } from "react";

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
        onClick={(event) => {
          // Click on the backdrop (the dialog element itself, outside its content box) closes it.
          if (event.target === event.currentTarget) dialogRef.current?.close();
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
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            className={buttonStyles({ variant: "danger", size: "sm" })}
          >
            Delete project
          </button>
        </div>
      </dialog>
    </>
  );
}
