import type { Metadata } from "next";

import { PlanButton } from "./plan-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { plan, remaining } = await remainingForPlan(supabase, user!.id);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">Plans</h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          You defend once, so you pay once. Access covers your preparation, not a recurring
          month you have to remember to cancel.
        </p>
      </header>

      {plan === "free" && (
        <Card elevation="base">
          <p className="text-sm font-medium text-ink">You are on the free plan</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
            <li>{remaining.answer ?? "unlimited"} questions to your project left</li>
            <li>{remaining.questions ?? "unlimited"} question sets left</li>
            <li>{remaining.mnemonics ?? "unlimited"} memory aid builds left</li>
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["proposal", "full"] as const).map((key) => {
          const limits = PLANS[key];
          const isCurrent = plan === key;

          return (
            <Card
              key={key}
              elevation={key === "full" ? "elevated" : "base"}
              className={key === "full" ? "bloom" : undefined}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl text-ink">{limits.label}</h2>
                {isCurrent && <Badge tone="ready">Current</Badge>}
              </div>

              <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-ink">
                {naira(PRICES_KOBO[key])}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                one payment · {limits.days} days of access
              </p>

              <ul className="mt-4 space-y-1.5 text-sm text-ink-muted">
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
