import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Supabase client for server components, server actions, and route handlers.
 *
 * Always create a fresh client per request - never hoist one into a module-level constant.
 * Next.js caches at the module level, and a shared client would leak one user's session
 * into another user's request.
 *
 * This still uses the anon key, so RLS applies here too. That is deliberate: the server
 * acting on a student's behalf should be bound by the same rules the student is.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server components cannot set cookies. This is expected and safe to ignore:
            // the proxy refreshes the session on every request, so the write that failed
            // here has already happened there.
          }
        },
      },
    },
  );
}
