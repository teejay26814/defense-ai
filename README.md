# Academia Scribes — Defense Coach

A personalised AI defense-preparation platform for final-year university students. A
student uploads their project (Chapters 1–5); the app turns it into an isolated knowledge
base, then helps them understand, remember, practise, and defend it.

> *If your defense was tomorrow, would you be ready?*

See [CLAUDE.md](./CLAUDE.md) for the product spec, security rules, and phase plan.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase · Zod

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in the two values
npm run dev
```

`.env.local` needs the project URL and anon key from
**Supabase → Project Settings → API**. Both are safe in the browser — the anon key is
public by design, and Row Level Security is what protects student data.

The app will not start without them. `src/lib/env.ts` validates both at boot and fails
with a message telling you what is missing, rather than silently misbehaving later.

## Database

Migrations live in `supabase/migrations/`, numbered and ordered.

```bash
npm run db:push    # apply pending migrations
npm run db:diff    # diff local schema against remote
```

### Connecting

`supabase db push` needs a direct database connection, which means two gotchas:

1. **`db.<ref>.supabase.co` resolves to IPv6 only.** On an IPv4-only network it fails with
   `getaddrinfo ENOTFOUND`. Use the session pooler instead.
2. **The pooler is region-specific**, and the username carries the project ref:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

If you do not know the region, connect to any regional pooler: the wrong one answers
`Tenant or user not found`, while the right one gets as far as authentication.

The database password is under **Project Settings → Database**. It is generated, not
chosen — if it is unknown, reset it. Note that a reset takes a short while to propagate,
so an immediate connection attempt can still fail.

## Layout

```
src/
  app/
    (auth)/         signed-out routes — login, signup, shared shell, server actions
    (app)/          authenticated routes — dashboard, app shell
    page.tsx        public landing page
    icon.svg        favicon, generated from the brand mark
  components/       logo and shared form primitives
  lib/
    env.ts          validated public environment
    supabase/       client.ts (browser) and server.ts (server) — do not mix them
    validation/     zod schemas
  proxy.ts          session refresh and route guarding
supabase/migrations/
Brand_Assest/       logo, palette, extracted SVG assets
```

### Two things that are easy to get wrong

**`src/proxy.ts`, not `middleware.ts`.** Next.js 16 deprecated the `middleware` file
convention; the exported function must be named `proxy`.

**Routes are denied by default.** `PUBLIC_ROUTES` in `src/proxy.ts` is an explicit
allowlist, so a new page is protected the moment it is created. Opening one up is a
deliberate edit.

## Security

- Only `NEXT_PUBLIC_*` values may reach the browser.
- The service-role key is not used anywhere and must never be imported into a client
  component — it bypasses RLS entirely.
- RLS is enabled on every table from the first one, scoped by `user_id`.
- Mutations go through server actions, not client-side database writes.

RLS is verified behaviourally, not just assumed: with two real sessions, a student cannot
read another student's profile, cannot overwrite it, cannot see it in a full table scan,
and an anonymous request sees nothing.

## Status

Phase 1 is complete: Supabase wired up, profiles table applied with RLS, auth screens,
app shell, and landing page.

Phase 2 is project creation, upload, storage, and document processing. Do not build ahead
of the current phase.

### Open decisions

- **Typography.** The logo is set in Biennale, but only in `FONTSPRINGDEMO` cuts, which
  are evaluation-only and cannot ship. `--font-display` and `--font-sans` are system
  stacks until this is resolved. See [Brand_Assest/palette.md](./Brand_Assest/palette.md).
- **The gold accent** `#C9A227` is derived, not brand. The logo is navy and white only.
- **The wordmark** could not be extracted from the logo PDF — it is live text bound to the
  unlicensed font. Only the book mark exists as SVG.
