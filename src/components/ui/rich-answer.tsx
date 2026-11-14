import type { ReactNode } from "react";

/**
 * Renders an AI answer's light formatting: paragraphs, bullet and numbered lists, **bold**,
 * and [n] citation markers.
 *
 * Current models write a little Markdown whether asked to or not, and shown raw the student
 * sees literal asterisks. This handles only the handful of constructs answers actually use,
 * and builds React elements rather than HTML strings, so nothing in an answer can inject
 * markup. Anything it does not recognise falls through as plain text.
 */
export function RichAnswer({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);

  return (
    <div className={className}>
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        const isBullets = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const isNumbered = lines.length > 0 && lines.every((l) => /^\s*\d+[.)]\s+/.test(l));

        if (isBullets || isNumbered) {
          const Tag = isNumbered ? "ol" : "ul";
          return (
            <Tag
              key={b}
              className={`${isNumbered ? "list-decimal" : "list-disc"} mt-4 space-y-2 pl-6 first:mt-0 marker:text-navy-500`}
            >
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""))}</li>
              ))}
            </Tag>
          );
        }

        // A heading-style line ("## Method") is shown as a bold lead-in, not a raw hash.
        const heading = /^#{1,6}\s+(.*)$/.exec(lines[0] ?? "");
        if (heading && lines.length === 1) {
          return (
            <p key={b} className="mt-5 font-semibold first:mt-0">
              {inline(heading[1])}
            </p>
          );
        }

        return (
          <p key={b} className="mt-4 first:mt-0">
            {lines.map((l, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {inline(l.replace(/^#{1,6}\s+/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** **bold**, *italic* and [n] citations within one line. */
function inline(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[\d+\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) out.push(line.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      out.push(
        <strong key={key++} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      out.push(
        <sup
          key={key++}
          className="figures-data mx-0.5 rounded bg-navy-050 px-1 py-px font-sans text-[0.65em] font-semibold text-brand"
        >
          {token.slice(1, -1)}
        </sup>,
      );
    } else {
      out.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}
