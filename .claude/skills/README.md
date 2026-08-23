# Skills

From [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), MIT licensed.
Ten of the twenty-four, chosen for what this project actually is: a shipped product handling
student coursework and real payments, whose weakest areas are its interface and its complete
absence of tests.

| Skill | Why it is here |
| --- | --- |
| `using-agent-skills` | Routes work to the right skill below. Install this or the others get forgotten. |
| `frontend-ui-engineering` | The weakest part of this product, and the thing most often complained about. WCAG 2.1 AA, and explicit guidance against generic AI-looking UI, which CLAUDE.md already forbids. |
| `security-and-hardening` | Student coursework, Paystack, and a service-role key that bypasses RLS. The highest-consequence area. |
| `test-driven-development` | There is not a single test in this repository. That is the largest real gap. |
| `performance-optimization` | Core Web Vitals, and the AI paths that make a student wait ten seconds. |
| `code-review-and-quality` | Before real students rely on it. |
| `debugging-and-error-recovery` | Sessions were lost to a stale `.next`, Avast intercepting TLS, and a shared n8n credential. A triage routine would have found each faster. |
| `observability-and-instrumentation` | `ai_usage` records cost, but there is no structured logging anywhere else. |
| `shipping-and-launch` | Actively launching. |
| `api-and-interface-design` | The six n8n webhook contracts are an API, and their payload shapes are load-bearing. |

## Design skills

From [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill),
MIT licensed. Three of its seven.

| Skill | Why it is here |
| --- | --- |
| `ui-ux-pro-max` | Searchable style, palette, font-pairing and UX-guideline data. The reason to keep it is that it reasons by product category, and an academic tool for anxious students is a very different brief from a consumer app. |
| `design-system` | Three-layer token architecture, which is what `globals.css` already reaches for with its `@theme` block. |
| `brand` | Visual identity and voice. `Brand_Assest/palette.md` records the two real brand colours and the Biennale licensing problem; this gives that somewhere to grow into. |

**`ui-styling` was deliberately not installed**, despite being the largest and most obviously
UI-shaped of them. It is built on shadcn/ui and Radix, and this project uses neither: it has
its own primitives on Tailwind 4's CSS-first `@theme`. Installing 5.8 MB of guidance for a
component library that is not here would push every future change towards rewriting what
already works. `banner-design` and `slides` are for marketing artefacts rather than the app.

## Deliberately not installed

The other fourteen are about deciding what to build (`interview-me`, `idea-refine`,
`spec-driven-development`, `planning-and-task-breakdown`) or about problems this project does
not have yet (`deprecation-and-migration` — nothing to deprecate; `ci-cd-and-automation` —
Netlify already builds on push). `code-simplification` and `git-workflow-and-versioning`
overlap with the `/simplify` command and the existing commit conventions.

They are one `cp` away in the source repo if any of that changes. Installing all
twenty-four would mostly add noise, and a skill that never fires is worse than absent because
it makes the list harder to scan.
