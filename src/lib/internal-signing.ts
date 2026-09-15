import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC signing for requests between our own server action and our own Netlify Background
 * Function - the same scheme `src/lib/n8n.ts` uses for outbound n8n calls, kept as a
 * separate secret so the two trust boundaries can be rotated independently.
 *
 * Deliberately has no `server-only` guard. The background function is a plain Node script
 * outside the Next.js bundle, not a request handler Next.js instruments - importing
 * `server-only` there throws, since nothing sets the bundler condition that module relies
 * on to allow it. This file is safe on both sides because it does nothing but hash a
 * string; it holds no secret of its own and touches no request-scoped state.
 */

export function signInternal(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** True if `signature` is a valid, recent (within 5 minutes) signature over `body`. */
export function verifyInternal(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) return false;

  const expected = signInternal(secret, timestamp, body);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
