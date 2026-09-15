"use client";

import { useState } from "react";

import { Flashcard } from "./flashcard";
import { StudySession } from "./study-session";
import { buttonStyles } from "@/components/ui/button";
import { CONFIDENCE_LABELS, type Question } from "@/lib/types";

/**
 * Two ways through the same cards.
 *
 * The list is for browsing and for picking at one particular question. The session is for
 * actually drilling. Both are wanted, and which one a student needs changes by the day, so
 * neither replaces the other.
 *
 * The session is what loads first. "Flashcards" said "click a card, it flips, the answer's
 * on the back" to more than one student in testing, and the list - answers a button-press
 * away, all on screen at once - was not read as that, even though the real flip lives one
 * click away on "Start a study session". Landing there directly removes the click that was
 * getting missed; the list is still one "Leave session" away for anyone who wants to browse
 * or jump to a specific question instead of drilling in order.
 *
 * Session order is the page's order, which is weakest first, so starting a session always
 * begins with the material they are least sure of.
 */
export function QuestionDeck({
  questions,
  projectId,
  quizHref,
}: {
  questions: Question[];
  projectId: string;
  quizHref: string;
}) {
  const [studying, setStudying] = useState(questions.length > 0);

  const reviewed = questions.filter((q) => q.confidence !== null);
  const shaky = questions.filter((q) => q.confidence === 1).length;
  const solid = questions.filter((q) => q.confidence === 3).length;

  if (studying) {
    return (
      <StudySession
        questions={questions}
        projectId={projectId}
        onExit={() => setStudying(false)}
      />
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-2xl text-ink">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </h2>
          <button
            type="button"
            onClick={() => setStudying(true)}
            className={buttonStyles({ size: "sm" })}
          >
            Start a study session
          </button>
          <a href={quizHref} className={buttonStyles({ variant: "secondary", size: "sm" })}>
            Take the quiz
          </a>
        </div>

        <p className="text-sm text-ink-muted">
          {reviewed.length === 0
            ? "None reviewed yet"
            : `${reviewed.length} reviewed · ${solid} ${CONFIDENCE_LABELS[3].toLowerCase()} · ${shaky} ${CONFIDENCE_LABELS[1].toLowerCase()}`}
        </p>
      </div>

      <ul className="border-t border-navy-100">
        {questions.map((q) => (
          <Flashcard key={q.id} question={q} projectId={projectId} />
        ))}
      </ul>
    </section>
  );
}
