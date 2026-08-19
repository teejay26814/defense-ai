"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { DIFFICULTY_LABELS, type Question } from "@/lib/types";

/**
 * The quiz.
 *
 * One question at a time, answer locked once chosen, feedback immediately. Locking matters:
 * a quiz you can revise after seeing the result teaches nothing, and the score stops
 * meaning anything.
 *
 * Feedback always shows what the project actually says, not just right or wrong. Being told
 * you are wrong without being shown the passage is the least useful possible outcome for
 * someone revising.
 *
 * Options are shuffled per attempt. The generator is told to vary the correct position, but
 * it drifts towards the first slot, and a student who notices that is learning the quiz
 * rather than their project.
 */

type Answered = { questionId: string; chosen: number; correct: boolean };

function shuffle<T>(items: T[], seed: number): T[] {
  // Deterministic per question so a re-render does not reshuffle underneath the student
  // mid-answer. Not cryptographic, and does not need to be.
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function QuizRunner({
  questions,
  projectId,
}: {
  questions: Question[];
  projectId: string;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answered[]>([]);

  const question = questions[index];
  const finished = index >= questions.length;

  if (finished) {
    const right = answers.filter((a) => a.correct).length;
    const pct = Math.round((right / answers.length) * 100);

    return (
      <div className="animate-scale-in bloom rounded-xl border border-navy-100 bg-white p-8 text-center shadow-elevated">
        <p className="font-sans text-5xl font-semibold leading-none tracking-tight text-ink">
          {right}
          <span className="text-2xl font-medium text-ink-muted">/{answers.length}</span>
        </p>
        <p className="mt-3 font-display text-xl text-ink">
          {pct >= 80
            ? "You know this material."
            : pct >= 50
              ? "Solid start. The gaps are worth another pass."
              : "Worth going back through your chapters."}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
          This is recognition, which is easier than recall. A panel will make you say it out
          loud, so use the flashcards for the ones you missed.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setChosen(null);
              setAnswers([]);
            }}
            className={buttonStyles()}
          >
            Take it again
          </button>
          <Link
            href={`/projects/${projectId}/questions`}
            className={buttonStyles({ variant: "secondary" })}
          >
            Back to flashcards
          </Link>
        </div>
      </div>
    );
  }

  // Seeded on the question id so the order is stable for this card but differs between them.
  const seed = question.id.split("-")[0];
  const numericSeed = parseInt(seed, 16) || 1;
  const order = shuffle(
    question.options!.map((text, i) => ({ text, original: i })),
    numericSeed,
  );

  const answered = chosen !== null;
  const chosenIsCorrect =
    answered && order[chosen].original === question.correct_option;

  function choose(i: number) {
    if (answered) return;
    setChosen(i);
    setAnswers((prev) => [
      ...prev,
      {
        questionId: question.id,
        chosen: i,
        correct: order[i].original === question.correct_option,
      },
    ]);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          Question {index + 1} of {questions.length}
        </p>
        <p className="text-sm text-ink-muted">
          {answers.filter((a) => a.correct).length} correct
        </p>
      </div>

      {/* Progress. Width only, so nothing reflows as it fills. */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-navy-300">
        <div
          className="h-full rounded-full bg-navy-700 transition-[width] duration-300"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      <div
        key={question.id}
        className="animate-scale-in rounded-xl border border-navy-100 bg-white p-6 shadow-elevated"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {question.chapter && <Badge tone="info">Chapter {question.chapter}</Badge>}
          <Badge tone="neutral">{DIFFICULTY_LABELS[question.difficulty] ?? "Explain"}</Badge>
        </div>

        <p className="font-display text-lg leading-snug text-ink">{question.question}</p>

        <ul className="stagger-children mt-5 space-y-2.5">
          {order.map((option, i) => {
            const isCorrect = option.original === question.correct_option;
            const isChosen = chosen === i;

            // Once answered, the right answer is always shown, not only when it was picked.
            const tone = !answered
              ? "border-navy-100 hover:border-navy-300 hover:bg-navy-050"
              : isCorrect
                ? "border-success bg-success/8"
                : isChosen
                  ? "border-danger bg-danger/8"
                  : "border-navy-100 opacity-60";

            return (
              <li key={option.original}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  disabled={answered}
                  aria-pressed={isChosen}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm leading-relaxed
                    transition-[background-color,border-color,opacity] duration-150
                    disabled:cursor-default ${tone}`}
                >
                  <span className="mr-2 font-semibold text-ink-muted">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-ink">{option.text}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {answered && (
          <div className="animate-rise mt-5">
            <p
              role="status"
              className={`text-sm font-medium ${chosenIsCorrect ? "text-success" : "text-danger"}`}
            >
              {chosenIsCorrect ? "Correct." : "Not quite."}
            </p>

            <div className="mt-3 rounded-lg border-l-2 border-gold bg-navy-050/60 py-3 pl-4 pr-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                From your project
              </p>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink">
                {question.model_answer}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIndex((i) => i + 1);
                setChosen(null);
              }}
              className={`mt-4 ${buttonStyles()}`}
            >
              {index + 1 === questions.length ? "See my score" : "Next question"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
