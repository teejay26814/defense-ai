import Link from "next/link";
import type { Metadata } from "next";

import { buttonStyles } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { currentPlan, PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Payment" };

/**
 * Where Paystack sends the browser back to.
 *
 * This page grants nothing. It reads the plan the webhook has already written, or explains
 * that it has not arrived yet. Anyone can visit a URL, so if landing here were enough to
 * unlock a plan, the plan would be a link.
 *
 * The wait is real and worth naming: the webhook is a separate request from Paystack to
 * this app, and it occasionally lands a moment after the student is redirected. Telling
 * them to refresh is better than showing "free" and letting them think the payment failed.
 */
export default async function BillingCallbackPage() {
  const supabase = await createClient();
  const plan = await currentPlan(supabase);

  const paid = plan !== "free";

  return (
    <div className="mx-auto max-w-lg">
      <div className="animate-scale-in rounded-feature border border-navy-100/70 bg-surface p-8 text-center shadow-lifted">
        {paid ? (
          <>
            <p className="label-eyebrow text-navy-500">
              Payment received
            </p>
            <h1 className="mt-3 font-display text-3xl text-ink">
              You are on {PLANS[plan].label}
            </h1>
            <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
              {PLANS[plan].days} more days of access have been added, with a fresh set of allowances.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/dashboard" className={buttonStyles()}>
                Back to your project
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl text-ink">Confirming your payment</h1>
            <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
              Paystack confirms payments in a separate message to us, which occasionally
              arrives a moment after you land here. Give it a few seconds and refresh.
            </p>
            <p className="mx-auto mt-3 max-w-prose text-xs text-ink-muted">
              If it still says this after a minute, nothing has been lost. Your payment is
              recorded with Paystack and we can match it to your account.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/billing/callback" className={buttonStyles()}>
                Refresh
              </Link>
              <Link href="/billing" className={buttonStyles({ variant: "secondary" })}>
                Back to plans
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
