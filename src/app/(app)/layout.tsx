import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

/**
 * Shell for the signed-in app.
 *
 * The proxy already blocks anonymous requests, but this checks again. Defence in depth:
 * a matcher change or a route that slips past the pattern must not silently expose
 * student data, and every page below here assumes `user` exists.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, institution")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-navy-100 bg-parchment/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/dashboard"
            className="rounded text-navy-700 transition-opacity duration-150 hover:opacity-80"
          >
            <Logo markClassName="h-7 w-auto" />
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 font-medium text-ink
                transition-colors duration-150 hover:bg-navy-050 active:bg-navy-100"
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              className="rounded-lg px-3 py-1.5 font-medium text-ink
                transition-colors duration-150 hover:bg-navy-050 active:bg-navy-100"
            >
              Projects
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink-muted sm:inline">
              {profile?.full_name ?? user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-navy-100 px-3 py-1.5 text-sm font-medium text-ink
                  transition-[background-color,border-color] duration-150
                  hover:border-navy-300 hover:bg-navy-050
                  active:bg-navy-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="sr-only">Signed in as {displayName}</p>
        {children}
      </main>
    </div>
  );
}
