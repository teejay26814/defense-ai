"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Tabs across a single project.
 *
 * These screens are all views of the same project, so they belong behind one nav rather
 * than being reachable only from buttons on the overview page. Before this, getting to the
 * quiz meant dashboard, then projects, then the project, then hunting for a button.
 *
 * Tools that need indexed text are shown but disabled until there is some, rather than
 * hidden. A student who cannot see the quiz assumes it does not exist; one who sees it
 * greyed out with a reason knows what to do next, which is the guardrail the dashboard
 * follows too.
 */

type Tab = { href: string; label: string; needsIndex: boolean };

export function ProjectNav({
  projectId,
  hasIndexedText,
}: {
  projectId: string;
  hasIndexedText: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const tabs: Tab[] = [
    { href: base, label: "Overview", needsIndex: false },
    { href: `${base}/ask`, label: "Ask", needsIndex: true },
    { href: `${base}/questions`, label: "Practice", needsIndex: true },
    { href: `${base}/quiz`, label: "Quiz", needsIndex: true },
    { href: `${base}/mnemonics`, label: "Memory aids", needsIndex: true },
    { href: `${base}/defense`, label: "Mock defense", needsIndex: true },
  ];

  return (
    <nav
      aria-label="Project sections"
      className="-mx-6 overflow-x-auto border-b border-navy-100 px-6"
    >
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          // Overview matches exactly; the rest match their own subtree so a nested page
          // keeps its tab lit.
          const active =
            tab.href === base ? pathname === base : pathname.startsWith(tab.href);

          const locked = tab.needsIndex && !hasIndexedText;

          if (locked) {
            return (
              <li key={tab.href}>
                <span
                  aria-disabled="true"
                  title="Upload a chapter and let it finish reading first"
                  className="inline-block cursor-not-allowed px-3 py-2.5 text-sm font-medium text-ink-muted/50"
                >
                  {tab.label}
                </span>
              </li>
            );
          }

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-block px-3 py-3 text-sm font-medium
                  transition-colors duration-200
                  after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full
                  after:origin-left after:transition-transform after:duration-300
                  after:content-[''] after:ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${
                    active
                      ? "text-ink after:scale-x-100 after:bg-navy-500"
                      : "text-ink-muted hover:text-ink after:scale-x-0 after:bg-navy-300 hover:after:scale-x-100"
                  }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
