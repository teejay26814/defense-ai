import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Routes reachable while signed out. Everything not listed here requires a session.
 *
 * Denying by default is the point: a new page is protected the moment it is created, and
 * a student cannot reach project data by guessing a URL. Opening a route up has to be a
 * deliberate edit to this list.
 */
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  // Where the links in Supabase's emails land. It must be reachable signed out, since the
  // whole point is that it establishes the session.
  "/auth/confirm",
  // Reachable signed out so it can explain that the link expired, rather than bouncing to
  // login where the student would have no idea what went wrong.
  "/reset-password",
];

/**
 * Routes that only make sense signed out - a signed-in student gets sent to the app.
 *
 * /reset-password is deliberately absent. A recovery link signs the student in on the way
 * through /auth/confirm, so by the time they arrive they *are* authenticated; listing it
 * here would redirect them to the dashboard and make setting a new password impossible.
 */
const SIGNED_OUT_ONLY_ROUTES = ["/login", "/signup", "/forgot-password"];

/** Where a signed-in student lands when they have no more specific destination. */
const APP_HOME = "/dashboard";

function matches(pathname: string, routes: string[]) {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  // This response is threaded through the Supabase client so refreshed auth cookies land
  // on it. It must be the object that gets returned, or the refreshed session is dropped
  // and the student is silently logged out on the next navigation.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with the auth server. getSession() only reads the
  // cookie, which the browser can tamper with, so it must not be trusted for a guard.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !matches(pathname, PUBLIC_ROUTES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can send them back afterwards.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && matches(pathname, SIGNED_OUT_ONLY_ROUTES)) {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Every path except static assets and image files. Auth cookies need refreshing on
     * real navigations, not on every icon request.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
