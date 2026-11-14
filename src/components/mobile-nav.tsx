"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconBook,
  IconBulb,
  IconGrid,
  IconMessage,
  IconShield,
  IconSpark,
} from "@/components/icons";

/**
 * The phone's tab bar.
 *
 * On a phone there is no room for the sidebar, and the study modes used to sit in a tab
 * strip that ran off the edge of the screen - so the five things a student opens the app
 * for were the hardest things to reach. This puts them where a thumb already is, the way
 * every app on their phone does. Hidden from lg up, where the sidebar takes over.
 *
 * Locked modes (no project, or nothing indexed yet) are shown dimmed rather than hidden, the
 * same rule as the sidebar: a student who cannot see Quiz assumes it does not exist.
 */
export function MobileNav({
  projectBase,
  hasIndexedText,
}: {
  projectBase: string | null;
  hasIndexedText: boolean;
}) {
  const pathname = usePathname();
  const study = (path: string) => (projectBase && hasIndexedText ? `${projectBase}${path}` : null);

  const items = [
    { href: "/dashboard", label: "Home", Icon: IconGrid },
    { href: study("/ask"), label: "Ask", Icon: IconMessage },
    { href: study("/questions"), label: "Cards", Icon: IconBook },
    { href: study("/quiz"), label: "Quiz", Icon: IconSpark },
    { href: study("/mnemonics"), label: "Memory", Icon: IconBulb },
    { href: study("/defense"), label: "Defense", Icon: IconShield },
  ];

  return (
    <nav
      aria-label="Study modes"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100/80 bg-surface/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgb(5_38_89_/_0.18)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {items.map(({ href, label, Icon }) => {
          const active = href ? (href === "/dashboard" ? pathname === href : pathname.startsWith(href)) : false;

          const inner = (
            <>
              <span
                className={`flex h-7 w-11 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ${
                  active ? "bg-navy-050 text-brand" : ""
                }`}
              >
                <Icon className="size-[19px]" />
              </span>
              <span className={`text-[11px] leading-none ${active ? "font-semibold text-brand" : "font-medium"}`}>
                {label}
              </span>
            </>
          );

          return (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-1 text-ink-muted transition-[transform,color] duration-150 hover:text-ink active:scale-90"
                >
                  {inner}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={projectBase ? "Upload a chapter and let it finish reading first" : "Add a project first"}
                  className="flex min-h-14 cursor-not-allowed flex-col items-center justify-center gap-1 text-ink-muted/40"
                >
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
