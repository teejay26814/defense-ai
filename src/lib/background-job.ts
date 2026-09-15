import "server-only";

import { signInternal } from "@/lib/internal-signing";

/**
 * Hand off to a Netlify Background Function, signed the same way as the outbound n8n
 * calls (src/lib/n8n.ts) but with its own secret - this app calling its own background
 * functions, not this app calling n8n.
 *
 * The function acknowledges with 202 in milliseconds regardless of how long the actual
 * work takes; anything else means the hand-off itself failed before the slow part even
 * started, which the caller needs to know so it can mark the job failed rather than leave
 * it pending forever.
 */
export async function fireBackgroundJob(functionName: string, payload: unknown): Promise<void> {
  const internalSecret = process.env.INTERNAL_JOB_SECRET;
  const siteUrl = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!internalSecret || !siteUrl) {
    throw new Error(`${functionName} is not configured on this deployment yet.`);
  }

  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());

  const res = await fetch(new URL(`/.netlify/functions/${functionName}`, siteUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-academia-signature": signInternal(internalSecret, timestamp, body),
      "x-academia-timestamp": timestamp,
    },
    body,
  });

  if (res.status !== 202) {
    throw new Error(`${functionName} responded ${res.status}`);
  }
}
