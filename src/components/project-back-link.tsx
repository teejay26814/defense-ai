"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The link above a project's title.
 *
 * On a phone the project's tab strip is replaced by the bottom tab bar, which has no
 * "Overview" (that is where chapters are uploaded). So inside a study mode, the back link
 * on a phone goes to the project overview; on the overview itself, and on larger screens
 * where the tabs are visible, it goes to the project list as before.
 */
export function ProjectBackLink({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const inSubpage = pathname !== base;

  const cls =
    "rounded text-sm text-ink-muted underline-offset-4 transition-colors duration-150 hover:text-brand hover:underline active:text-ink";

  return (
    <>
      <Link href={inSubpage ? base : "/projects"} className={`${cls} lg:hidden`}>
        ← {inSubpage ? "Project overview" : "All projects"}
      </Link>
      <Link href="/projects" className={`${cls} hidden lg:inline`}>
        ← All projects
      </Link>
    </>
  );
}
