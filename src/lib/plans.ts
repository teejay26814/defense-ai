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
  /** Highest chapter number this plan will index: 1 means Chapter 1 only, 3 means 1-3. */
  chapters: number;
  projects: number;
  /** Null means no limit. */
  answer: number | null;
  questions: number | null;
  mnemonics: number | null;
  /** Mock defense sittings in the window. 0 means the feature is not included. */
  defense: number;
  /** Questions per mock defense sitting. */
  sittingLength: number;
  /** Days of access bought. Null for free, which does not expire. */
  days: number | null;
};

/**
 * Every allowance is finite, on every plan, on purpose.
 *
 * Each figure is an AI call that costs real money (see docs/monetisation-plan.md and the
 * ai_cost_estimate view). The paid allowances are sized so that a student who uses every
 * last one costs roughly what they paid, and a typical student - who uses perhaps a third -
 * leaves a healthy margin. "Unlimited" at these prices would mean the most engaged
 * students lose money on every sale.
 *
 * Windows are short because preparation is: students get serious in the last two to four
 * weeks before a defense. Buying again extends access from the current end date (see the
 * Paystack webhook), so a student who bought early is not punished for it.
 */
export const PLANS: Record<Plan, PlanLimits> = {
  /**
   * Free has one job: get the student's own chapter indexed and put a real examiner
   * question from it in front of them - plus one short mock defense, because sitting one
   * is the moment the product stops being a study tool and becomes a rehearsal. It is
   * deliberately not enough to prepare a whole defense on.
   */
  free: {
    label: "Free",
    chapters: 1,
    projects: 1,
    answer: 5,
    questions: 2,
    mnemonics: 1,
    defense: 1,
    sittingLength: 5,
    days: null,
  },
  proposal: {
    label: "Proposal defense",
    chapters: 3,
    projects: 1,
    answer: 40,
    questions: 4,
    mnemonics: 2,
    defense: 2,
    sittingLength: 8,
    days: 21,
  },
  full: {
    label: "Final defense",
    chapters: 5,
    projects: 1,
    answer: 70,
    questions: 6,
    mnemonics: 3,
    defense: 4,
    sittingLength: 8,
    days: 30,
  },
};

/**
 * Daily caps, per kind of request, over a rolling 24 hours, on every plan.
 *
 * The plan allowance bounds the total; this bounds the pace, so an allowance meant for a
 * few weeks cannot be burned - by a student or a script - in one night. Enforced in
 * Postgres by take_ai_slot(), which also applies a speed limit (one AI request every five
 * seconds) and an hourly ceiling of 40 across everything.
 */
export const DAILY_LIMITS: Record<SlotOperation, number> = {
  answer: 15,
  questions: 3,
  mnemonics: 2,
  // Marking one answer is one request. Three full sittings a day is far beyond what anyone
  // preparing seriously would do.
  evaluate: 24,
  defense: 3,
};

/** Every kind of request that has to claim a slot before it reaches a model. */
export type SlotOperation = "answer" | "questions" | "mnemonics" | "evaluate" | "defense";

/**
 * Prices, in kobo.
 *
 * Kobo rather than naira because Paystack charges in the smallest unit, and holding money
 * as a float anywhere is how rounding errors become refunds.
 *
 * Set against the allowances above at Claude Sonnet 5.5 rates: a student who uses every
 * allowance costs roughly the price in AI calls; a typical one costs about a third of it.
 * Revisit once ai_cost_estimate (and the OpenRouter dashboard) has real history.
 */
export const PRICES_KOBO: Record<Exclude<Plan, "free">, number> = {
  proposal: 200_000, // ₦2,000
  full: 350_000, // ₦3,500
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
        : `You have used all ${limit} of these on your plan.`,
      plan,
    );
  }

  await takeAiSlot(supabase, operation as SlotOperation, plan);
  return plan;
}

const SLOT_MESSAGES: Record<string, string> = {
  too_fast: "One moment - please wait a few seconds before the next request.",
  hourly: "You have made a lot of requests in the last hour. Take a short break, then carry on.",
  daily: "You have reached today's limit for this. It frees up again over the next 24 hours.",
  unauthenticated: "Your session has ended. Please sign in again.",
};

/**
 * Claim a slot for one AI request, or refuse it.
 *
 * Called after the plan allowance check and immediately before the AI call, so a refused
 * plan check never uses up a slot. The speed, hourly and daily rules live in Postgres
 * (take_ai_slot), where they can be applied atomically - two clicks in the same instant
 * cannot both get through.
 */
export async function takeAiSlot(
  supabase: SupabaseClient,
  operation: SlotOperation,
  plan: Plan,
): Promise<void> {
  const { data, error } = await supabase.rpc("take_ai_slot", {
    op: operation,
    daily_limit: DAILY_LIMITS[operation],
  });

  if (error) {
    // Fail open, matching the allowance check above: a database hiccup must not lock a
    // student out the night before their defense. The plan allowance and the OpenRouter
    // spending cap still bound the cost.
    console.error("[takeAiSlot] failed", error);
    return;
  }

  if (data) {
    throw new PlanLimitError(SLOT_MESSAGES[data as string] ?? SLOT_MESSAGES.too_fast, plan);
  }
}

/**
 * May this student start another mock defense sitting? Returns the plan and how many
 * questions the sitting gets, or throws PlanLimitError.
 *
 * Sittings are counted from defense_sessions in the current window (lifetime on free).
 * Each answer in a sitting is marked by a model call, so the number of sittings times
 * their length is what bounds mock-defense cost.
 */
export async function assertDefenseAllowance(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ plan: Plan; sittingLength: number }> {
  const plan = await currentPlan(supabase);
  const { defense: limit, sittingLength } = PLANS[plan];

  if (limit === 0) {
    throw new PlanLimitError("Mock defense is not included in your plan.", plan);
  }

  const count = await sittingsUsed(supabase, userId, plan);
  if (count >= limit) {
    throw new PlanLimitError(
      plan === "free"
        ? "You have used your free mock defense. Upgrade to sit more."
        : `You have used all ${limit} mock defenses on your plan.`,
      plan,
    );
  }

  return { plan, sittingLength };
}

/** Mock defense sittings started in the current window. */
export async function sittingsUsed(
  supabase: SupabaseClient,
  userId: string,
  plan: Plan,
): Promise<number> {
  const windowStart = await planWindowStart(supabase, plan);
  let query = supabase
    .from("defense_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (windowStart) query = query.gte("started_at", windowStart);
  const { count } = await query;
  return count ?? 0;
}

/** When the current paid window began. Null on free, where counts are lifetime. */
export async function planWindowStart(
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
