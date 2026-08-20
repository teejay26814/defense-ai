import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Paystack.
 *
 * Chosen over Flutterwave for a Nigerian student market: better local card and bank
 * transfer support, and students recognise the checkout page, which matters more than it
 * sounds when someone is deciding whether to enter their card details.
 *
 * The secret key never leaves the server, per CLAUDE.md. Nothing here is importable from a
 * client component - "server-only" makes that a build error rather than a code review.
 */

const API = "https://api.paystack.co";

/** Whether the secret key is present at all. Distinguishes misconfiguration from a forgery. */
export function isConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Get it from the Paystack dashboard under " +
        "Settings, API Keys, and put it in .env.local.",
    );
  }
  return key;
}

export type InitialisedTransaction = {
  authorizationUrl: string;
  reference: string;
};

/**
 * Start a transaction.
 *
 * The amount is passed in by the caller from the server-side price table, never taken from
 * the request. If the browser could name the price, the price would be whatever the browser
 * said it was.
 */
export async function initialiseTransaction(params: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitialisedTransaction> {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: "NGN",
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.status) {
    // Logged in full, surfaced as nothing: a provider error can carry account details.
    console.error("[paystack] initialise failed", res.status, body);
    throw new Error("Payment could not be started. Please try again.");
  }

  return {
    authorizationUrl: body.data.authorization_url as string,
    reference: body.data.reference as string,
  };
}

/**
 * Verify a webhook signature.
 *
 * Paystack signs the raw request body with HMAC SHA512 using the secret key. Without this
 * check, anyone who knows the endpoint can POST a fake "payment succeeded" and grant
 * themselves a subscription, so this is the single most important function in the payment
 * path.
 *
 * Compared with timingSafeEqual rather than ===, so the comparison cannot be attacked by
 * measuring how long it takes to fail.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  // Never throws. A missing key is a deployment fault, not an authentication one, and the
  // caller checks isConfigured() separately so the two get different status codes.
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return false;

  const expected = createHmac("sha512", key).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");

  // timingSafeEqual throws on a length mismatch, which would itself leak the length.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Confirm a transaction with Paystack directly.
 *
 * Belt and braces on top of the signature: the webhook says what happened, this asks
 * Paystack whether it agrees. Cheap, and it closes the gap if a signing key ever leaks.
 */
export async function verifyTransaction(reference: string): Promise<{
  paid: boolean;
  amountKobo: number;
  metadata: Record<string, unknown>;
} | null> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${secretKey()}` },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.status) {
    console.error("[paystack] verify failed", res.status, body);
    return null;
  }

  return {
    paid: body.data?.status === "success",
    amountKobo: Number(body.data?.amount ?? 0),
    metadata: (body.data?.metadata ?? {}) as Record<string, unknown>,
  };
}
