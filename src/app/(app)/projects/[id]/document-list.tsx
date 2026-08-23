import { deleteDocument, retryExtraction } from "../actions";
import { formatBytes, type DocumentSummary } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  ready: "bg-success/10 text-success",
  failed: "bg-danger/10 text-danger",
  extracting: "bg-warning/10 text-warning",
  uploaded: "bg-navy-100 text-navy-700",
};

const STATUS_LABELS: Record<string, string> = {
  ready: "Read",
  failed: "Could not read",
  extracting: "Reading…",
  uploaded: "Uploaded",
};

export function DocumentList({
  documents,
  projectId,
}: {
  documents: DocumentSummary[];
  projectId: string;
}) {
  if (documents.length === 0) {
    return (
      <p className="border-t border-navy-100 py-10 text-center text-ink-muted">
        No documents yet. Upload your first chapter to get started.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {documents.map((d) => (
        <li
          key={d.id}
          className="rule-hairline py-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {d.chapter && (
                  <span className="rounded bg-navy-050 px-1.5 py-0.5 text-xs font-medium text-navy-700">
                    Ch. {d.chapter}
                  </span>
                )}
                <h3 className="font-medium text-ink">{d.label}</h3>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[d.status] ?? STATUS_STYLES.uploaded
                  }`}
                >
                  {STATUS_LABELS[d.status] ?? d.status}
                </span>
              </div>

              <p className="mt-1 truncate text-xs text-ink-muted">
                {d.file_name} · {formatBytes(d.size_bytes)}
                {d.word_count !== null && ` · ${d.word_count.toLocaleString()} words`}
                {d.page_count !== null && ` · ${d.page_count} pages`}
              </p>

              {d.status === "failed" && d.error_message && (
                <p className="mt-2 max-w-prose text-xs text-danger">{d.error_message}</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {d.status === "failed" && (
                <form action={retryExtraction}>
                  <input type="hidden" name="documentId" value={d.id} />
                  <input type="hidden" name="projectId" value={projectId} />
                  <button
                    type="submit"
                    className="rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs font-medium text-ink
                      transition-[background-color,border-color] duration-150
                      hover:border-navy-300 hover:bg-navy-050 active:bg-navy-100"
                  >
                    Try again
                  </button>
                </form>
              )}

              <form action={deleteDocument}>
                <input type="hidden" name="documentId" value={d.id} />
                <input type="hidden" name="projectId" value={projectId} />
                <button
                  type="submit"
                  className="rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-ink-muted
                    transition-[background-color,color] duration-150
                    hover:bg-danger/8 hover:text-danger active:bg-danger/15"
                >
                  Remove
                </button>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
