import { CHAPTERS, type DocumentStatus } from "@/lib/types";

/**
 * The chapter map.
 *
 * Five rows, one per chapter, showing what is in and what is missing. This is the visual
 * form of the dashboard's one job: answer *what do I need to do next?*
 *
 * It is a status list rather than a chart, on purpose. Five items with four states is not
 * magnitude data - there is nothing to compare in length. A bar chart here would be five
 * bars all the same height.
 *
 * Status is never carried by colour alone: every row has an icon, a word, and a position.
 * That is the rule for status encoding, and it is also what makes the list readable at a
 * glance on a phone.
 */

export type ChapterState = "missing" | "processing" | "failed" | "ready";

const STATE: Record<
  ChapterState,
  { label: string; dot: string; text: string; icon: "check" | "dot" | "alert" | "empty" }
> = {
  ready: { label: "Indexed", dot: "bg-success", text: "text-success", icon: "check" },
  processing: { label: "Reading", dot: "bg-gold", text: "text-navy-700", icon: "dot" },
  failed: { label: "Could not read", dot: "bg-danger", text: "text-danger", icon: "alert" },
  missing: { label: "Not uploaded", dot: "bg-navy-300", text: "text-ink-muted", icon: "empty" },
};

function StateIcon({ kind }: { kind: "check" | "dot" | "alert" | "empty" }) {
  // Hairline strokes, sized to sit on the cap-height of the label beside them.
  const common = { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": true } as const;

  if (kind === "check") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M2.5 7.5 5.5 10.5 11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "alert") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M7 3.5v4" strokeLinecap="round" />
        <circle cx="7" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "dot") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="7" cy="7" r="3.5" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="7" cy="7" r="4.5" strokeDasharray="2 2.5" />
    </svg>
  );
}

export function chapterStateFrom(
  status: DocumentStatus | undefined,
  embedded: boolean,
): ChapterState {
  if (!status) return "missing";
  if (status === "failed") return "failed";
  // "ready" means the text was extracted. Until the chunks are embedded it is not
  // searchable, so calling it ready on the dashboard would overstate what the student has.
  if (status === "ready") return embedded ? "ready" : "processing";
  return "processing";
}

export function ChapterProgress({
  states,
}: {
  /** Keyed by chapter number, 1 to 5. Anything absent is treated as missing. */
  states: Map<number, ChapterState>;
}) {
  return (
    <ul className="divide-y divide-navy-100">
      {CHAPTERS.map((chapter) => {
        const state = states.get(chapter.value) ?? "missing";
        const spec = STATE[state];

        return (
          <li key={chapter.value} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden
              className={`size-1.5 shrink-0 rounded-full ${spec.dot}`}
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{chapter.hint}</p>
              <p className="text-xs text-ink-muted">{chapter.label}</p>
            </div>

            <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${spec.text}`}>
              <StateIcon kind={spec.icon} />
              {spec.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
