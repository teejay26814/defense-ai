import type { Metadata } from "next";

import { PlanButton } from "./plan-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  PLANS,
  PRICES_KOBO,
  remainingForPlan,
  sittingsUsed,
  type Plan,
} from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

const DAY_MS = 24 * 60 * 60 * 1000;

// Kept outside the components: reading the clock is impure, and this page is rendered per
// request on the server, so "now" only needs to be read once per render path.
function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / DAY_MS);
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Plans.
 *
 * Written as a window rather than a subscription, and the page says so plainly. A student
 * deciding whether to pay is asking "what do I get and for how long", and hiding the
 * answer behind a monthly figure would be the beginning of a bad relationship with someone
 * who has one defense and limited money.
 *
 * Windows are short (three to four weeks), so the page also answers "when should I buy?"
 * from the student's own defense date. Buying too early and watching access lapse the week
 * before the defense is the one way a short window can hurt someone.
 */
export default async function BillingPage() {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  const [{ plan, remaining }, { data: project }, { data: sub }] = await Promise.all([
    remainingForPlan(supabase, user!.id),
    supabase
      .from("projects")
      .select("defense_date")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("expires_at")
      .eq("status", "active")
      .gt("expires_at", nowIso())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const sittings = await sittingsUsed(supabase, user!.id, plan);
  const limits = PLANS[plan];
  const expiresAt = sub?.expires_at ? new Date(sub.expires_at as string) : null;
  const defenseDate = project?.defense_date ? new Date(project.defense_date as string) : null;
  const daysToDefense = defenseDate ? daysUntil(defenseDate) : null;
  const daysOfAccess = expiresAt ? daysUntil(expiresAt) : null;

  const figures = [
    { label: "Asks", value: remaining.answer },
    { label: "Question sets", value: remaining.questions },
    { label: "Memory aids", value: remaining.mnemonics },
    { label: "Mock defenses", value: Math.max(0, limits.defense - sittings) },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="label-eyebrow">Access</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Plans</h1>
        <p className="measure mt-3 text-ink-muted">
          You defend once, so you pay once. Each plan covers the last few weeks of
          preparation - no monthly charge to remember to cancel.
        </p>
      </header>

      <Timing daysToDefense={daysToDefense} plan={plan} daysOfAccess={daysOfAccess} />

      <div>
        <p className="label-eyebrow">
          {plan === "free" ? "On the free plan, remaining" : `${limits.label}, remaining`}
          {expiresAt && (
            <span className="normal-case tracking-normal">
              {" "}
              · until{" "}
              {expiresAt.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}
            </span>
          )}
        </p>
        {/*
          What is left, set as figures rather than a sentence. A student deciding whether
          to pay is doing arithmetic, and large numerals answer that in a glance.
        */}
        <dl className="mt-4 grid grid-cols-2 border-t border-navy-100 sm:grid-cols-4">
          {figures.map((item) => (
            <div
              key={item.label}
              className="border-b border-navy-100 py-5 pr-4 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <dd className="figures-display font-sans text-3xl font-semibold text-ink">
                {item.value ?? 0}
              </dd>
              <dt className="label-eyebrow mt-1">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["proposal", "full"] as const).map((key) => {
          const p = PLANS[key];
          const isCurrent = plan === key;

          return (
            <Card key={key} elevation={key === "full" ? "elevated" : "base"}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl text-ink">{p.label}</h2>
                {isCurrent && <Badge tone="ready">Current</Badge>}
              </div>

              <p className="figures-display mt-4 font-sans text-4xl font-semibold text-ink">
                {naira(PRICES_KOBO[key])}
              </p>
              <p className="label-eyebrow mt-2">one payment · {p.days} days</p>

              <ul className="mt-6 space-y-2 border-t border-navy-100 pt-5 text-sm text-ink-muted">
                <li>
                  Chapters 1 to {p.chapters}
                  {key === "proposal" ? " - for your proposal or seminar" : " - the whole project"}
                </li>
                <li>{p.answer} questions to your project</li>
                <li>
                  {p.questions} sets of examiner questions, with flashcards and quizzes
                </li>
                <li>{p.mnemonics} sets of memory aids</li>
                <li>
                  {p.defense} mock defenses with a readiness score
                </li>
              </ul>

              <PlanButton
                plan={key}
                label={isCurrent ? `Add ${p.days} more days` : `Get ${p.label}`}
                variant={key === "full" ? "primary" : "secondary"}
              />
            </Card>
          );
        })}
      </div>

      <p className="max-w-prose text-xs leading-relaxed text-ink-muted">
        Payments are handled by Paystack. Card details never reach this app. Buying again
        adds days to the end of your current access, so nothing you have paid for is lost.
        Daily limits keep the service fast for everyone.
      </p>
    </div>
  );
}

/** "When should I buy?", answered from the student's own defense date. */
function Timing({
  daysToDefense,
  plan,
  daysOfAccess,
}: {
  daysToDefense: number | null;
  plan: Plan;
  daysOfAccess: number | null;
}) {
  let message: string;

  if (daysToDefense === null || daysToDefense < 0) {
    message =
      "Plans last three to four weeks, so buy when your defense is about three weeks away. " +
      "Add your defense date to your project and this page will tell you which plan covers it.";
  } else if (daysOfAccess !== null && daysOfAccess >= daysToDefense) {
    message = `Your defense is in ${daysToDefense} day${daysToDefense === 1 ? "" : "s"}, and your access covers it.`;
  } else if (daysToDefense > PLANS.full.days!) {
    message =
      `Your defense is in ${daysToDefense} days - more than any plan lasts. Keep using ` +
      `${plan === "free" ? "the free plan" : "your current access"} for now, and buy when it is ` +
      "about three weeks away so your access runs right up to the day.";
  } else if (daysToDefense > PLANS.proposal.days!) {
    message =
      `Your defense is in ${daysToDefense} days. Final defense (${PLANS.full.days} days) covers it; ` +
      `Proposal's ${PLANS.proposal.days} days would end ${daysToDefense - PLANS.proposal.days!} days early.`;
  } else {
    message = `Your defense is in ${daysToDefense} day${daysToDefense === 1 ? "" : "s"}. Either plan covers it.`;
  }

  return (
    <p className="rounded-surface bg-surface px-5 py-4 text-sm leading-relaxed text-ink shadow-raised">
      {message}
    </p>
  );
}
