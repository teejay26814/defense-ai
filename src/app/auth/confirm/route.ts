import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/validation/auth";

/**
 * Where the links in Supabase's emails land.
 *
 * This route has to exist. With @supabase/ssr the session lives in cookies set server-side,
 * so the token in a confirmation or recovery link must be exchanged here - there is no
 * client-side fallback that can write those cookies. Without this route the link cannot
 * sign anyone in, which is precisely the state this app was in.
 *
 * Supabase's email templates must point here. The default template uses
 * {{ .ConfirmationURL }}; change it to:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Email }}&next=/dashboard
 *
 * The token is single-use and short-lived, so a failure here is far more often an expired
 * or already-used link than anything sinister. The message says so, rather than implying
 * the student did something wrong.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirect(searchParams.get("next"));

  // Redirects are built from nextUrl, never from request.url. On Netlify the latter
  // resolves to the branch host (main--site.netlify.app) even when the request arrived on
  // the canonical domain, and the auth cookie verifyOtp just set belongs to the canonical
  // host. Redirecting across the two silently drops the session, so the student lands on
  // the reset page and is told their link expired.
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    const [pathname, search] = path.split("?");
    url.pathname = pathname;
    url.search = search ? `?${search}` : "";
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type) {
    return redirectTo("/login?notice=invalid-link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error("[auth/confirm] verifyOtp failed", error.message);
    return redirectTo("/login?notice=expired-link");
  }

  // A recovery link signs the student in so they can set a new password. Sending them to
  // the dashboard instead would leave them logged in with a password they cannot remember.
  const destination = type === "recovery" ? "/reset-password" : next;

  return redirectTo(destination);
}
