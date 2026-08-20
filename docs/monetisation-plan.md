# Monetisation plan

A plan, not an implementation. Nothing here is built yet.

CLAUDE.md puts subscriptions in Phase 7 and we are finishing Phase 4, so this is written
ahead deliberately. See **Sequencing** at the end for why building it now would sell less
than building it after Phase 5.

## The model: pay per defense, not per month

A student defends **once**. They prepare hard for a few weeks, walk into the room, and never
open the product again. Monthly billing fits that badly: they would pay once and cancel, and
the business would depend on people forgetting to.

So access is bought as a **window**, sized to the preparation period.

| Tier | Covers | Window |
| --- | --- | --- |
| **Free** | 1 project, 1 chapter, 10 questions, 5 asks, no mock defense | no expiry |
| **Proposal** | Chapters 1-3, unlimited practice, quiz, memory aids | 60 days |
| **Full defense** | All 5 chapters, everything, plus the mock defense | 90 days |

The free tier's job is one moment: the student sees a real examiner question generated from
their own Chapter One. That is what convinces them, not a feature list. It must be generous
enough to reach that moment and no further.

The tiers deliberately mirror `DEFENSE_SCOPES` in `src/lib/types.ts`, which already
distinguishes a proposal defense from a final one. Students already understand that
difference, so the pricing needs no explaining.

## Metering: count actions, never tokens

Two reasons not to meter tokens, despite it being the obvious instinct.

**Students do not know what a token is.** "40,000 tokens remaining" communicates nothing.
"12 question sets left" is instantly clear, and a limit a student cannot understand is a
limit they experience as the product breaking.

**Token counts are not currently available.** Generation runs through n8n's `chainLlm`
node, which returns the completion but not usage. This is why `ai_usage` records
`chunks_sent` as a cost proxy rather than real counts, and it is documented in that
migration. Billing on tokens would mean replacing `chainLlm` with a direct HTTP request to
OpenRouter in every workflow, which undoes the canvas-editing benefit n8n was chosen for.

**So: the student sees actions, the business sees cost.** Both come from the same table.

### Where the counts come from

No new counter table. `ai_usage` already records one row per AI call with `user_id`,
`operation` and `created_at`, so usage in a period is a query rather than a number that can
drift out of step with reality:

```sql
select count(*) from public.ai_usage
 where user_id = $1 and operation = 'answer'
   and created_at >= $2;          -- period start
```

A counter column would eventually disagree with what actually happened. A count never does.

### Where the limit is enforced

In the server action, before the n8n call, never in the UI. The UI should also show what is
left, but a disabled button is a courtesy, not a control - the action is the boundary, the
same way RLS rather than the interface is what separates students.

One helper, called at the top of each generating action:

```ts
await assertWithinPlan(supabase, user.id, "questions");
```

## Schema sketch

```sql
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  plan          text not null check (plan in ('free','proposal','full')),
  status        text not null check (status in ('active','expired','refunded')),

  starts_at     timestamptz not null default now(),
  expires_at    timestamptz,          -- null for free

  -- Paystack's own reference, and the amount actually charged in kobo. Stored rather than
  -- recomputed: prices change, and a receipt must say what was paid at the time.
  reference     text unique,
  amount_kobo   integer,
  currency      text not null default 'NGN',

  created_at    timestamptz not null default now()
);
```

RLS: a student may read their own row and nothing else. **No insert or update policy for
students at all** - subscriptions are written only by the payment webhook running with the
service-role key. A student who can write this table can grant themselves premium.

That is the one place in this codebase where the service-role key is justified, and the
reasoning is worth stating: the webhook arrives from Paystack with no student session, so
there is no session for RLS to act on. It must therefore be a route handler that trusts
nothing except a verified signature.

Entitlements themselves live in code, not in the database - a plain map from plan to limits.
They are product decisions that should be reviewed in a diff, not rows someone can edit.

## Payments: Paystack

For a Nigerian student market, Paystack over Flutterwave: better local card and bank
transfer support, a cleaner API, and students recognise the checkout page, which matters
more than it sounds when someone is deciding whether to enter their card details.

Flutterwave becomes the better argument if this ever sells outside Nigeria.

### The flow

1. Student picks a tier. A **server action** calls Paystack to initialise a transaction and
   returns the authorisation URL. The amount is set server-side from the entitlements map,
   never taken from the request - otherwise the price is whatever the browser says it is.
2. Student is redirected to Paystack and pays.
3. Paystack redirects them back to `/billing/callback`, which shows a friendly waiting
   state. **This redirect grants nothing.**
4. Paystack POSTs to `/api/webhooks/paystack`. That route verifies the signature, then
   writes the subscription.

### The two rules that matter

**Access is granted by the webhook, never by the redirect.** The callback URL is just the
browser coming back; anyone can visit it. If it granted access, premium would be a URL.

**Verify the signature.** Paystack signs the body with HMAC SHA512 using the secret key and
sends it as `x-paystack-signature`. Compare with a timing-safe equality check. Without this,
a forged POST is a free subscription.

Handle the same reference arriving twice - Paystack retries. The `unique` constraint on
`reference` makes a repeat write a no-op rather than a second window.

## Cost control, before pricing anything

Pricing needs a cost per student, and that number is not known yet. Two things to do first.

**Ask runs on `anthropic/claude-opus-4.1`.** It is the most expensive model in use, on the
most-used feature. Questions and mnemonics already run on Sonnet. Moving Ask to Sonnet is
one field on the n8n canvas and likely removes most of the largest cost line. Test whether
the answers actually get worse before assuming they will.

**Then read `ai_usage`.** It has been recording since it was added. Calls per student per
operation, multiplied by model rates, is the real number. Guessing at it before then would
produce a price with nothing behind it.

One useful anchor already exists: Academia Scribes charges ₦80,000 for a full project on the
basic plan, per the pricing in the Telegram support bot. A student already paying that will
not blink at a defense-preparation tool priced at a small fraction of it. That frames the
ceiling; the AI cost frames the floor.

## Sequencing

**Build Phase 5 before charging for anything.**

The Full defense tier's headline is the mock defense - type your answer, have it graded
against your own project, get a readiness score you earned rather than one counted from
uploads. It does not exist yet. Selling the tier now means selling flashcards and a quiz,
which is a much weaker offer, and it also means the first paying students get less than the
page promised.

Order:

1. **Phase 5** - mock defense, answer evaluation, a real readiness score
2. **Move Ask to Sonnet**, then read `ai_usage` for a genuine cost per student
3. **Then** subscriptions, limits and Paystack, priced against that number

The plumbing that makes this possible is already in place: `ai_usage` is recording every
call, and `DEFENSE_SCOPES` already encodes the tier boundaries. Nothing here needs
rebuilding, only building on.
