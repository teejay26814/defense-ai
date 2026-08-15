import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Phase 1 dashboard.
 *
 * The guardrail is that this page must always answer "what do I need to do next?". At
 * this phase there is exactly one answer — upload your project — because project creation
 * and upload are Phase 2. It deliberately does not fake cards for features that do not
 * exist yet.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, institution, department")
    .eq("id", user!.id)
    .maybeSingle();

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl text-ink">
          {firstName ? `Welcome, ${firstName}.` : "Welcome."}
        </h1>
        <p className="mt-2 text-ink-muted">
          Here is what to do next.
        </p>
      </header>

      <section className="field-parchment surface-grain rounded-2xl border border-navy-100 p-8 shadow-elevated">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">
          Next step
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">Upload your project</h2>
        <p className="mt-2 max-w-prose text-ink-muted">
          Add your chapters and we will build your private knowledge base from them —
          every answer grounded in your own work, with the chapter it came from.
        </p>

        <button
          type="button"
          disabled
          className="mt-6 rounded-lg bg-navy-700 px-4 py-2.5 font-medium text-white shadow-elevated
            transition-[transform,background-color,opacity] duration-150
            hover:bg-navy-600 active:translate-y-px
            disabled:cursor-not-allowed disabled:opacity-50"
        >
          Upload project
        </button>
        <p className="mt-3 text-xs text-ink-muted">
          Coming in the next phase.
        </p>
      </section>

      {(profile?.institution || profile?.department) && (
        <section className="rounded-xl border border-navy-100 bg-white/60 p-5 shadow-base">
          <h3 className="font-display text-lg text-ink">Your details</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {profile.institution && (
              <div>
                <dt className="text-ink-muted">Institution</dt>
                <dd className="mt-0.5 font-medium">{profile.institution}</dd>
              </div>
            )}
            {profile.department && (
              <div>
                <dt className="text-ink-muted">Department</dt>
                <dd className="mt-0.5 font-medium">{profile.department}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
