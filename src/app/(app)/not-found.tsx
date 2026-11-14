import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { buttonStyles } from "@/components/ui/button";

/**
 * notFound() from inside the app - most often a project id that does not exist or belongs
 * to someone else (RLS makes those indistinguishable, deliberately). Rendered inside the
 * app shell so the student keeps their navigation.
 */
export default function AppNotFound() {
  return (
    <EmptyState
      title="We could not find that"
      description="It may have been deleted, or the link is out of date. Your other projects are untouched."
      action={
        <Link href="/projects" className={buttonStyles()}>
          See my projects
        </Link>
      }
    />
  );
}
