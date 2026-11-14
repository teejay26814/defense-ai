import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoMark } from "@/components/logo";
import {
  IconBook,
  IconBulb,
  IconFolder,
  IconGrid,
  IconMessage,
  IconShield,
  IconSignOut,
  IconSpark,
} from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient, getUser } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

/**
 * Shell for the signed-in app: a persistent sidebar rather than a top bar.
 *
 * The proxy already blocks anonymous requests, but this checks again. Defence in depth:
 * a matcher change or a route that slips past the pattern must not silently expose
 * student data, and every page below here assumes `user` exists.
 *
 * "Study modes" live here now rather than only in the per-project tab bar
 * (components/project-nav.tsx), which still exists for switching between a project's own
 * screens once you are inside one. The two are complementary, not duplicates: the sidebar
 * is the fast path to your most recent project from anywhere in the app - the dashboard, a
 * different project, deep in Plans - and the in-project tabs are for a student working
 * across more than one project at a time, which the sidebar alone cannot address without
 * a project switcher this redesign does not yet have.
 *
 * A locked study-mode link behaves exactly as the in-project tabs already do: shown,
 * disabled, with a reason - never hidden. A student who cannot see Quiz assumes it does not
 * exist; one who sees it greyed out knows what to do next.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [supabase, user] = await Promise.all([createClient(), getUser()]);

  if (!user) redirect("/login");

  // This layout wraps every authenticated page, so any round-trip here is paid on every
  // navigation. Neither query below depends on the other's result - both only need the
  // session getUser() already established - so they run together rather than as a
  // waterfall. That was previously two sequential awaits for no reason.
  const [{ data: profile }, { data: current }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    // The same "current project" as the dashboard: most recently created. Sidebar
    // study-mode links jump straight there, which is the whole point of putting them
    // somewhere that is never more than one click away.
    //
    // The indexed-chunk count rides along as an embedded aggregate, filtered to embedded
    // rows, rather than as a second query that had to wait for this one's id. One
    // round-trip instead of two, on every signed-in page.
    supabase
      .from("projects")
      .select("id, chunks(count)")
      .eq("chunks.embedded", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const displayName = profile?.full_name?.trim().split(/\s+/)[0];
  const initials =
    (profile?.full_name ?? user.email ?? "?")
      .split(/\s+/)
      .map((s: string) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const chunkCount = (current?.chunks as { count: number }[] | undefined)?.[0]?.count ?? 0;
  const hasIndexedText = chunkCount > 0;

  const studyBase = current ? `/projects/${current.id}` : null;

  const studyModes = [
    { href: studyBase ? `${studyBase}/ask` : null, label: "Ask my project", icon: IconMessage },
    { href: studyBase ? `${studyBase}/questions` : null, label: "Flashcards", icon: IconBook },
    { href: studyBase ? `${studyBase}/quiz` : null, label: "Quiz", icon: IconSpark },
    { href: studyBase ? `${studyBase}/mnemonics` : null, label: "Memory aids", icon: IconBulb },
    { href: studyBase ? `${studyBase}/defense` : null, label: "Mock defense", icon: IconShield },
  ];

  const workspace = [
    { href: "/dashboard", label: "Overview", icon: IconGrid },
    { href: "/projects", label: "My projects", icon: IconFolder },
  ];

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      {/* --- sidebar, desktop --- */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 px-5 py-6 text-white lg:flex">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded px-1 transition-opacity duration-150 hover:opacity-85"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-navy-500 text-white">
            <LogoMark className="h-5 w-auto" />
          </span>
          <span className="font-display text-base leading-tight">
            <span className="block font-semibold">Academia</span>
            <span className="block font-light text-white/70">Scribes</span>
          </span>
        </Link>

        <SidebarSection title="Workspace" className="mt-10">
          {workspace.map((item) => (
            <SidebarLink key={item.href} {...item} />
          ))}
        </SidebarSection>

        <SidebarSection title="Study modes" className="mt-8">
          {studyModes.map((item) => (
            <SidebarLink
              key={item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              locked={!item.href || !hasIndexedText}
            />
          ))}
        </SidebarSection>

        <div className="mt-auto pt-6">
          <SidebarLink href="/billing" label="Plans" icon={IconShield} />
          <ThemeToggle variant="row" className="mt-1 text-white/60 hover:bg-white/5 hover:text-white" />
          <form action={signOut} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-white/60
                transition-[transform,background-color,color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.98]"
            >
              <IconSignOut className="size-[18px] shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* --- top bar, mobile only --- */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-navy-100/70 bg-navy-050/90 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-xl sm:px-5 lg:hidden">
        <Link
          href="/dashboard"
          aria-label="Overview"
          className="rounded-control p-1 text-brand transition-opacity duration-150 hover:opacity-85 active:opacity-70"
        >
          <LogoMark className="h-7 w-auto" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 text-sm">
          <Link href="/dashboard" className={MOBILE_LINK}>
            Overview
          </Link>
          <Link href="/projects" className={MOBILE_LINK}>
            Projects
          </Link>
          <Link href="/billing" className={MOBILE_LINK}>
            Plans
          </Link>
        </nav>
        <div className="flex items-center gap-0.5">
          <ThemeToggle className="text-ink-muted hover:bg-surface hover:text-ink" />
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              title="Sign out"
              className="flex size-10 items-center justify-center rounded-control text-ink-muted
                transition-[transform,background-color,color] duration-150
                hover:bg-surface hover:text-ink active:scale-95"
            >
              <IconSignOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </header>

      {/* --- main content --- */}
      <div className="min-w-0 flex-1">
        <div className="hidden items-center justify-between border-b border-navy-100/70 px-8 py-4 lg:flex">
          <div>
            <p className="label-eyebrow">Workspace</p>
            <p className="mt-0.5 font-display text-lg text-ink">
              {displayName ? `Good to see you, ${displayName}` : "Good to see you"}
            </p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white">
            {initials}
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
          <p className="sr-only">Signed in as {displayName ?? user.email}</p>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Mobile top-bar links: a 40px tap target with hover, focus (global ring) and press states. */
const MOBILE_LINK =
  "rounded-control px-2.5 py-2 font-medium text-ink-muted transition-[transform,background-color,color] duration-150 " +
  "hover:bg-surface hover:text-ink active:scale-95";

function SidebarSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/35">
        {title}
      </p>
      <div className="mt-2 space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  locked = false,
}: {
  href: string | null;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  locked?: boolean;
}) {
  if (locked || !href) {
    return (
      <span
        aria-disabled="true"
        title={
          !href
            ? "Add a project first"
            : "Upload a chapter and let it finish reading first"
        }
        className="flex cursor-not-allowed items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-white/25"
      >
        <Icon className="size-[18px] shrink-0" />
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-white/75
        transition-[transform,background-color,color] duration-150 hover:bg-white/8 hover:text-white active:scale-[0.98]"
    >
      <Icon className="size-[18px] shrink-0" />
      {label}
    </Link>
  );
}
