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
      <header className="sticky top-0 z-20 border-b border-navy-100/70 bg-parchment/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link
            href="/dashboard"
            className="rounded text-navy-700 transition-opacity duration-150 hover:opacity-80"
          >
            <Logo markClassName="h-7 w-auto" />
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted
                transition-colors duration-150 hover:bg-navy-050 hover:text-ink active:bg-navy-100"
            >
              Dashboard
            </Link>
            <Link
              href="/projects"
              className="rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted
                transition-colors duration-150 hover:bg-navy-050 hover:text-ink active:bg-navy-100"
            >
              Projects
            </Link>
            <Link
              href="/billing"
              className="rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted
                transition-colors duration-150 hover:bg-navy-050 hover:text-ink active:bg-navy-100"
            >
              Plans
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-ink-muted sm:inline">
              {profile?.full_name ?? user.email}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted
                  transition-colors duration-150 hover:bg-navy-050 hover:text-ink active:bg-navy-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <p className="sr-only">Signed in as {displayName}</p>
        {children}
      </main>
    </div>
  );
}
