# CLAUDE.md — Academia Scribes Defense Coach

## What this product is

A personalized AI defense-preparation platform for final-year university students. A student
uploads their project (Chapters 1–5); the app turns it into an isolated knowledge base, then
helps them understand, remember, practice, and defend it.

The north star: *"If your defense was tomorrow, would you be ready?"*

This is **not** a generic PDF summarizer or chatbot. The student's own project is the center
of the product. Every AI answer should be grounded in their uploaded documents and cite the
chapter it came from.

## The feature test

Before adding anything, ask:

> Does this help the student **understand**, **remember**, **practice**, or **defend** their project?

If not, it does not belong in the MVP.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** — CSS-first config via `@theme` in `globals.css`. There is no
  `tailwind.config.js` in v4; do not create one.
- **Supabase** — auth, Postgres, storage, pgvector, RLS. This is the source of truth.
- **n8n** — orchestration and workflow automation only. **Never** the primary database.
- **Zod** — validate all user input at the boundary.

### TypeScript version is pinned

`typescript` is pinned to **6.0.3**, deliberately below the npm `latest` tag.
`eslint-config-next` depends on `typescript-eslint`, which peer-requires
`typescript >=4.8.4 <6.1.0`. TypeScript 7.x is outside that range and breaks linting.
**Do not upgrade TypeScript** without first confirming `typescript-eslint` supports it.

## Build order

Build incrementally. Do not attempt the whole product at once.

1. **Phase 1** — setup, Supabase, auth, basic UI ✔ *done*
2. **Phase 2** — project creation, upload, storage, document processing ← *current*
3. **Phase 3** — RAG, knowledge base, Ask My Project *(AI provider chosen here)*
4. **Phase 4** — defense questions, flashcards, quizzes
5. **Phase 5** — mock defense, answer evaluation, readiness score
6. **Phase 6** — defense insights, weakness detection
7. **Phase 7** — voice defense, examiner personalities, subscriptions

Do not build ahead of the current phase. Do not invent features that were not agreed.

## Security rules — non-negotiable

- **No secrets in the frontend.** Only `NEXT_PUBLIC_*` values may reach the browser.
- **Users never supply their own AI API keys.** All provider keys stay server-side.
- Never expose: AI provider keys, n8n credentials, or the Supabase **service-role** key.
  The service-role key bypasses RLS — it may only be used in trusted server-side code, and
  must never be imported into a client component.
- **RLS is enabled on every table**, from the first one. A student must never be able to
  reach another student's project, documents, chunks, questions, answers, or AI context.
- Scope every table by `user_id`, and by `project_id` wherever project data is involved.
- Flow: frontend → our backend/API → n8n / AI providers. The browser never calls a provider.

## AI integration rules

- Keep the provider **replaceable**. Do not couple the codebase to one vendor's SDK shape.
- Ground answers in the student's project; prefer their documents over general knowledge.
- Return a source reference (chapter, section, page) whenever possible.
- Track usage — `user_id`, `project_id`, operation, model, tokens, estimated cost — because
  this is multi-user SaaS and AI cost has to stay controllable.

## Design guardrails

The app should feel personal, intelligent, academic, encouraging, clear, fast, and premium —
never intimidating, and never generic "AI SaaS".

The dashboard must always answer: **what do I need to do next?**

- **Colors:** never the default Tailwind palette (`indigo-500`, `blue-600`, …). Use the
  custom academic palette defined as `@theme` tokens.
- **Shadows:** no flat `shadow-md`. Use layered, color-tinted shadows at low opacity.
- **Typography:** never the same font for headings and body. Pair a display/serif with a
  clean sans.
- **Gradients:** layer multiple radial gradients; add grain via an SVG noise filter.
- **Animation:** only `transform` and `opacity`. **Never `transition-all`** — always name the
  property.
- **Interactive states:** every clickable element needs `hover`, `focus-visible`, and
  `active`.
- **Images:** apply a gradient overlay and a color treatment.
- **Spacing:** intentional, consistent tokens — not random Tailwind steps.
- **Depth:** a real layering system (base → elevated → floating), not one flat plane.
- Mobile-first responsive.

## Brand assets

Check **`Brand_Assest/`** before designing (note the spelling — that is the actual folder
name). If a logo or palette exists there, use it; do not substitute placeholders for real
assets.

The logo is currently a PDF that cannot be rendered in this environment (`poppler-utils` is
not installed). Until a PNG/SVG export or explicit hex values are provided, the palette is a
working assumption and may need revising.

## Conventions

- Route groups: `(auth)` for signed-out pages, `(app)` for authenticated pages.
- Supabase clients are split by environment and must not be mixed:
  - `src/lib/supabase/client.ts` — browser
  - `src/lib/supabase/server.ts` — server components and actions
  - `src/proxy.ts` — session refresh and route guarding. Next.js 16 deprecated the
    `middleware` file convention in favour of `proxy`; the exported function must be
    named `proxy`, not `middleware`.
- Public environment values are validated once in `src/lib/env.ts`. Only `NEXT_PUBLIC_*`
  may be read there — that module reaches the browser.
- Routes are denied by default. `src/proxy.ts` holds an explicit `PUBLIC_ROUTES` list, so
  a newly created page is protected until it is deliberately opened up.
- Mutations go through **server actions**, not client-side database writes.
- Migrations live in `supabase/migrations/`, numbered and ordered.
- Keep modules small and focused. Avoid unnecessary dependencies.

## Priorities, in order

1. Working product
2. Excellent UX
3. Reliable project-grounded AI
4. Strong security
5. Low AI cost
6. Maintainable architecture
