import type { Metadata } from "next";

import { PlanButton } from "./plan-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient, getUser } from "@/lib/supabase/server";
import { PLANS, PRICES_KOBO, remainingForPlan } from "@/lib/plans";

export const metadata: Metadata = { title: "Plans" };

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

/**
 * Plans.
 *
 * Written as a window rather than a subscription, and the page says so plainly. A student
 * deciding whether to pay is asking "what do I get and for how long", and hiding the
 * answer behind a monthly figure would be the beginning of a bad relationship with someone
 * who has one defense and limited money.
 */
export default async function BillingPage() {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  const { plan, remaining } = await remainingForPlan(supabase, user!.id);

  return (
    <div className="space-y-8">
      <header>
        <p className="label-eyebrow">Access</p>
        <h1 className="mt-2 font-display text-4xl text-ink">Plans</h1>
        <p className="measure mt-3 text-ink-muted">
          You defend once, so you pay once. Access covers your preparation, not a recurring
          month you have to remember to cancel.
        </p>
      </header>

      {plan === "free" && (
        <div>
          <p className="label-eyebrow">On the free plan, remaining</p>
          {/*
            What is left, set as figures rather than a sentence. A student deciding whether
            to pay is doing arithmetic, and three large numerals answer that in a glance
            where "you have 3 question sets left" has to be read.
          */}
          <dl className="mt-4 grid grid-cols-3 border-t border-navy-100">
            {[
              { label: "Asks", value: remaining.answer },
              { label: "Question sets", value: remaining.questions },
              { label: "Memory aids", value: remaining.mnemonics },
            ].map((item) => (
              <div key={item.label} className="border-r border-navy-100 py-5 pr-4 last:border-r-0">
                <dd className="figures-display font-sans text-3xl font-semibold text-ink">
                  {item.value ?? "∞"}
                </dd>
                <dt className="label-eyebrow mt-1">{item.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["proposal", "full"] as const).map((key) => {
          const limits = PLANS[key];
          const isCurrent = plan === key;

          return (
            <Card key={key} elevation={key === "full" ? "elevated" : "base"}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl text-ink">{limits.label}</h2>
                {isCurrent ? (
                  <Badge tone="ready">Current</Badge>
                ) : (
                  key === "full" && (
                    <span className="label-eyebrow text-navy-500">Recommended</span>
                  )
                )}
              </div>

              <p className="figures-display mt-4 font-sans text-4xl font-semibold text-ink">
                {naira(PRICES_KOBO[key])}
              </p>
              <p className="label-eyebrow mt-2">one payment · {limits.days} days</p>

              <ul className="mt-6 space-y-2 border-t border-navy-100 pt-5 text-sm text-ink-muted">
                <li>
                  Chapters 1 to {limits.chapters}
                  {key === "proposal" && " - before you collect data"}
                </li>
                <li>Unlimited questions, quiz and memory aids</li>
                <li>Unlimited questions to your own project</li>
                <li>
                  {limits.defense === 0
                    ? "No mock defense"
                    : "Mock defense with a real readiness score"}
                </li>
              </ul>

              {!isCurrent && (
                <PlanButton
                  plan={key}
                  label={`Get ${limits.label}`}
                  variant={key === "full" ? "primary" : "secondary"}
                />
              )}
            </Card>
          );
        })}
      </div>

      <p className="max-w-prose text-xs leading-relaxed text-ink-muted">
        Payments are handled by Paystack. Card details never reach this app. Prices are
        provisional while the running costs settle, and anyone who pays before they change
        keeps what they paid for.
      </p>
    </div>
  );
}
