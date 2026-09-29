"use client";

import { useState } from "react";

import { recordConfidence } from "./actions";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { ProjectExcerpt } from "@/components/ui/project-excerpt";
import {
  CONFIDENCE_LABELS,
  DIFFICULTY_LABELS,
  type Question,
} from "@/lib/types";

/**
 * One flashcard.
 *
 * The answer is hidden until asked for, which is the whole point: a card that shows both
 * sides at once is a document, not practice. Retrieval only works if you try to recall
 * first.
 *
 * There is no flip animation. A rotation would hide the question at the moment the student
 * most wants to compare it with the answer, and the design rules here permit transform and
 * opacity only - so the answer expands beneath the question instead, and both stay visible.
 */
export function Flashcard({
  question,
  projectId,
}: {
  question: Question;
  projectId: string;
}) {
  const [revealed, setRevealed] = useState(false);

  const answered = question.confidence !== null;

  return (
    <li className="rule-hairline py-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {question.chapter && (
          <Badge tone="info">Chapter {question.chapter}</Badge>
        )}
        <Badge tone="neutral">
          {DIFFICULTY_LABELS[question.difficulty] ?? "Explain"}
        </Badge>
        {answered && (
          <Badge tone={question.confidence === 3 ? "ready" : question.confidence === 2 ? "pending" : "attention"}>
            {CONFIDENCE_LABELS[question.confidence!]}
          </Badge>
        )}
      </div>

      <p className="measure font-display text-xl leading-snug text-ink">{question.question}</p>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className={`mt-4 ${buttonStyles({ variant: "secondary", size: "sm" })}`}
        >
          Show what my project says
        </button>
      ) : (
        <div className="mt-4">
          <ProjectExcerpt>
            <p className="measure mt-2 whitespace-pre-line leading-relaxed text-ink">
              {question.model_answer}
            </p>
          </ProjectExcerpt>

          {/*
            Asked only after the answer is visible. Rating a question you have not seen the
            answer to is guessing, and it would poison the readiness score built from these.
          */}
          <form action={recordConfidence} className="mt-4">
            <input type="hidden" name="questionId" value={question.id} />
            <input type="hidden" name="projectId" value={projectId} />

            <p className="mb-2 text-xs text-ink-muted">
              Could you have said that in front of a panel?
            </p>

            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="submit"
                  name="confidence"
                  value={level}
                  className={buttonStyles({
                    variant: question.confidence === level ? "primary" : "secondary",
                    size: "sm",
                  })}
                >
                  {CONFIDENCE_LABELS[level]}
                </button>
              ))}
            </div>
          </form>
        </div>
      )}
    </li>
  );
}
