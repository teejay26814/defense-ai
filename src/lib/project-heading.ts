import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * A project's id and title, fetched once per request.
 *
 * The project layout renders the title and the overview page's generateMetadata puts it
 * in the tab; both run in the same request, so they share this rather than each querying
 * the same row. RLS still applies - another student's project comes back null, exactly as
 * one that does not exist.
 */
export const getProjectHeading = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  return data;
});
