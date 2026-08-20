import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiOperation } from "@/lib/usage";

/**
 * What each plan allows.
 *
 * Limits live in code rather than in the database on purpose. They are product decisions
 * that should be reviewed in a diff and shipped deliberately, not rows that can be edited
 * in a dashboard at two in the morning. The database holds who paid for what; this holds
 * what that entitles them to.
 *
 * Counted per plan window, not per calendar month: a student who buys 90 days gets their
 * allowance across those 90 days. Free has no window, so its counts are lifetime, which is
 * the point - free is a demonstration, not a small subscription.
 */

export type Plan = "free" | "proposal" | "full";

export type PlanLimits = {
  label: string;
  /** Chapters this plan will index and draw on. */
  chapters: number;
  projects: number;
  /** Null means no limit. */
  answer: number | null;
  questions: number | null;
  mnemonics: number | null;
  /** Mock defense sittings. Null means no limit; 0 means the feature is not included. */
  defense: number | null;
  /** Days of access bought. Null for free, which does not expire. */
  days: number | null;
};

export const PLANS: Record<Plan, PlanLimits> = {
  /**
   * Free has one job: get the student's own chapter indexed and put a real examiner
   * question from it in front of them. That is the moment they believe it. It is
   * deliberately not enough to prepare a whole defense on.
   */
  free: {
    label: "Free",
    chapters: 1,
    projects: 1,
    answer: 5,
    questions: 2,
    mnemonics: 1,
    defense: 0,
    days: null,
  },
  proposal: {
    label: "Proposal defense",
    chapters: 3,
    projects: 1,
    answer: null,
    questions: null,
    mnemonics: null,
    defense: null,
    days: 60,
  },
  full: {
    label: "Full defense",
    chapters: 5,
    projects: 3,
    answer: null,
    questions: null,
    mnemonics: null,
    defense: null,
    days: 90,
  },
};

/**
 * Prices, in kobo.
 *
 * Kobo rather than naira because Paystack charges in the smallest unit, and holding money
 * as a float anywhere is how rounding errors become refunds.
 *
 * These are placeholders until ai_usage has enough history to give a real cost per student.
 * Setting them from a guess would be pricing with nothing behind it.
 */
export const PRICES_KOBO: Record<Exclude<Plan, "free">, number> = {
  proposal: 350_000, // ₦3,500
  full: 600_000, // ₦6,000
};

/** Which AI operations are metered. Embedding is not: it is cheap and it is the on-ramp. */
const METERED: Partial<Record<AiOperation, keyof PlanLimits>> = {
  answer: "answer",
  questions: "questions",
  mnemonics: "mnemonics",
};

export class PlanLimitError extends Error {
  constructor(
    message: string,
    readonly plan: Plan,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export async function currentPlan(supabase: SupabaseClient): Promise<Plan> {
  const { data, error } = await supabase.rpc("current_plan");
  if (error) {
    // Fail closed. A database hiccup must not hand out unlimited access, and free is still
    // a working product rather than a locked door.
    console.error("[currentPlan] lookup failed", error);
    return "free";
  }
  return (data as Plan) ?? "free";
}

/**
 * Refuse the call if this student has used up their allowance.
 *
 * Called in the server action, before the AI request, never in the UI. A disabled button is
 * a courtesy; the action is the boundary - the same reasoning that puts RLS rather than the
 * interface between one student and another's project.
 *
 * Usage is counted from ai_usage rather than a counter column, so the number can never
 * drift from what actually happened. Failed calls count too: a generation that timed out
 * still cost money, and a student who could retry a failing operation without limit is a
 * hole in the meter.
 */
export async function assertWithinPlan(
  supabase: SupabaseClient,
  userId: string,
  operation: AiOperation,
): Promise<Plan> {
  const plan = await currentPlan(supabase);
  const key = METERED[operation];
  if (!key) return plan;

  const limit = PLANS[plan][key] as number | null;
  if (limit === null) return plan;

  const windowStart = await planWindowStart(supabase, plan);

  let query = supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("operation", operation);

  if (windowStart) query = query.gte("created_at", windowStart);

  const { count, error } = await query;

  if (error) {
    console.error("[assertWithinPlan] count failed", error);
    // Fail open on a counting error rather than blocking a paying student over a query
    // that failed. The cost of the occasional extra call is far below the cost of a
    // student unable to prepare the night before their defense.
    return plan;
  }

  if ((count ?? 0) >= limit) {
    throw new PlanLimitError(
      plan === "free"
        ? `You have used all ${limit} of these on the free plan. Upgrade to keep going.`
        : `You have reached the limit of ${limit} for this plan.`,
      plan,
    );
  }

  return plan;
}

/** When the current paid window began. Null on free, where counts are lifetime. */
async function planWindowStart(
  supabase: SupabaseClient,
  plan: Plan,
): Promise<string | null> {
  if (plan === "free") return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("starts_at")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.starts_at as string | undefined) ?? null;
}

/** How many of each remain, for showing in the UI. Never the enforcement path. */
export async function remainingForPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ plan: Plan; remaining: Partial<Record<AiOperation, number | null>> }> {
  const plan = await currentPlan(supabase);
  const windowStart = await planWindowStart(supabase, plan);
  const remaining: Partial<Record<AiOperation, number | null>> = {};

  for (const [operation, key] of Object.entries(METERED) as [
    AiOperation,
    keyof PlanLimits,
  ][]) {
    const limit = PLANS[plan][key] as number | null;
    if (limit === null) {
      remaining[operation] = null;
      continue;
    }

    let query = supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("operation", operation);

    if (windowStart) query = query.gte("created_at", windowStart);

    const { count } = await query;
    remaining[operation] = Math.max(0, limit - (count ?? 0));
  }

  return { plan, remaining };
}
