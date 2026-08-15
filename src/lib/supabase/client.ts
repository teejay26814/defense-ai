import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Supabase client for the browser.
 *
 * Use this only in client components. It carries the anon key, so every query it makes is
 * subject to Row Level Security — which is exactly what keeps one student out of another
 * student's project. Never reach for the service-role key here.
 *
 * For anything that writes, prefer a server action over calling this directly.
 */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
