import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { PLANS, type Plan } from "@/lib/plans";
import { isConfigured, verifyTransaction, verifyWebhookSignature } from "@/lib/paystack";

/**
 * Where Paystack tells us a payment succeeded.
 *
 * This is the only place in the app that writes a subscription, and the only place that
 * uses the service-role key. Both facts follow from the same thing: the request arrives
 * from Paystack with no student session, so there is no session for RLS to act on. It
 * therefore trusts nothing except a verified signature.
 *
 * Access is granted here and nowhere else. The browser is also redirected back to
 * /billing/callback after paying, but that page grants nothing - anyone can visit a URL,
 * and if visiting it were enough, premium would be a link.
 */

export async function POST(request: NextRequest) {
  // The raw body, before any parsing. The signature is over the exact bytes Paystack sent,
  // so re-serialising a parsed object would produce a different string and never match.
  const raw = await request.text();

  // Checked before the signature so a misconfigured deployment answers 500 and Paystack
  // retries, rather than 401 which would look like a forgery and be silently dropped.
  if (!isConfigured()) {
    console.error("[paystack webhook] PAYSTACK_SECRET_KEY is not set on this deployment");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(raw, request.headers.get("x-paystack-signature"))) {
    console.error("[paystack webhook] bad signature");
    // 401 rather than 400: this is an authentication failure, and saying so plainly is
    // more useful in a log than a generic bad request.
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Paystack sends several event types down the same endpoint. Anything that is not a
  // successful charge is acknowledged and ignored - returning an error would make Paystack
  // retry an event we simply do not care about.
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const data = event.data ?? {};
  const reference = String(data.reference ?? "");
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const userId = String(metadata.userId ?? "");
  const plan = String(metadata.plan ?? "") as Plan;

  if (!reference || !userId || !(plan in PLANS) || plan === "free") {
    console.error("[paystack webhook] unusable payload", { reference, userId, plan });
    // 200 on purpose: the payload is wrong in a way retrying cannot fix, so asking
    // Paystack to send it again forever helps nobody.
    return NextResponse.json({ received: true });
  }

  // Ask Paystack directly rather than trusting the body alone. The signature already
  // proves origin; this proves the payment actually succeeded, and costs one request.
  const confirmed = await verifyTransaction(reference);
  if (!confirmed?.paid) {
    console.error("[paystack webhook] not confirmed as paid", reference);
    return NextResponse.json({ received: true });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !url) {
    // A 500 here is correct: the payment is real and unrecorded, so Paystack should retry.
    console.error("[paystack webhook] service role key or url missing");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buying again extends access from the current end date rather than from today, so a
  // student who bought early (or tops up for a defense that moved) never loses days they
  // already paid for. The allowance itself starts fresh with the new window.
  const days = PLANS[plan].days ?? 30;
  const { data: latest } = await admin
    .from("subscriptions")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = Math.max(
    Date.now(),
    latest?.expires_at ? new Date(latest.expires_at as string).getTime() : 0,
  );
  const expiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan,
    status: "active",
    reference,
    amount_kobo: confirmed.amountKobo,
    expires_at: expiresAt,
  });

  if (error) {
    // 23505 is unique_violation on `reference`, which means this event has already been
    // processed. Paystack retries, so this is expected rather than a fault, and the
    // constraint is what makes a retry a no-op instead of a second window.
    if (error.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    console.error("[paystack webhook] insert failed", error);
    return NextResponse.json({ error: "could not record" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
