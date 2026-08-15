import { z } from "zod";

/**
 * Public environment values, validated once at the boundary.
 *
 * Only NEXT_PUBLIC_* values belong here — this module is imported by browser code, so
 * anything added below ships to the client. Server-only secrets (the service-role key,
 * AI provider keys, n8n credentials) must never be read through this file.
 *
 * Next.js inlines NEXT_PUBLIC_* at build time by literal text match, so `process.env`
 * has to be indexed with the full name spelled out. Destructuring it will not work.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL is missing")
    .url("NEXT_PUBLIC_SUPABASE_URL must be a full URL, e.g. https://xyz.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
  throw new Error(
    `Supabase environment is not configured:\n${issues}\n\n` +
      `Copy .env.local.example to .env.local and fill in the values from\n` +
      `Supabase → Project Settings → API, then restart the dev server.`,
  );
}

export const env = parsed.data;
