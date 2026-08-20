"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { PRICES_KOBO } from "@/lib/plans";
import { initialiseTransaction } from "@/lib/paystack";
import { toFieldErrors } from "@/lib/validation/auth";

export type BillingState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const schema = z.object({ plan: z.enum(["proposal", "full"]) });

/**
 * Start a checkout.
 *
 * The amount comes from PRICES_KOBO here on the server, never from the form. The form
 * carries only which plan was chosen; if it carried the price, the price would be whatever
 * the browser said it was.
 *
 * The student's id goes into Paystack's metadata so the webhook knows whose subscription to
 * write. It comes from the session, not the request, for the same reason.
 */
export async function startCheckout(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const parsed = schema.safeParse({ plan: formData.get("plan") });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const { plan } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let transaction;
  try {
    transaction = await initialiseTransaction({
      email: user.email,
      amountKobo: PRICES_KOBO[plan],
      callbackUrl: `${origin}/billing/callback`,
      metadata: { userId: user.id, plan },
    });
  } catch (err) {
    console.error("[startCheckout] failed", err);
    return { error: "Payment could not be started. Please try again." };
  }

  redirect(transaction.authorizationUrl);
}
