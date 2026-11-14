import { cache } from "react";
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

/**
 * The signed-in student, verified with the auth server - once per request.
 *
 * getUser() is a network round-trip to Supabase Auth. The app layout and the page beneath
 * it both need the user, and Next renders them in the same request, so without this every
 * signed-in navigation paid for the same check twice (three times counting the proxy).
 * React's cache() is scoped to a single server request, so one student's user can never
 * leak into another's.
 *
 * Still getUser(), never getSession(): the session cookie can be tampered with, so it is
 * not trusted for anything that gates data.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
