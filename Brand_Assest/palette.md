# Palette

## Extracted from the logo

These are measured values, not guesses. `Academia Scribes Logo.pdf` could not be rendered
(`poppler-utils` is not installed), but its content streams were parsed directly: the
colour space is `ICCBased` with `N 3`, so the operands below are true RGB.

| Hex | Source | Where it appears in the logo |
| --- | --- | --- |
| `#052659` | `0.0196 0.149 0.349 scn` | The full-bleed 432×432 background square |
| `#FFFFFF` | `1 1 1 scn` | The mark and the wordmark |
| `#000000` | `0 0 0 scn` | 5 uses, inside an optional-content group — almost certainly a mask, not a brand colour |

The artwork is 432×432pt (6in square) and fully vector — there are no raster images in it,
and no colour beyond the three above. So the brand as delivered is **navy and white**.

## Working palette

Only `#052659` and `#FFFFFF` come from the logo. Everything else below is derived from
that navy and is a **proposal** — it is the honest minimum needed to build a UI, not
brand law. Replace any of it the moment there is a real brand spec.

### Navy scale

Derived by holding the logo navy's hue and shifting lightness. `navy-700` is the exact
logo colour and must not be adjusted.

| Token | Hex | Use |
| --- | --- | --- |
| `navy-900` | `#010F26` | Deepest ground, footer, dark-mode canvas |
| `navy-800` | `#02193C` | Elevated surface on dark |
| `navy-700` | `#052659` | **The logo navy.** Primary brand surface |
| `navy-600` | `#0A3A7D` | Hover state for primary surfaces |
| `navy-500` | `#1155A8` | Interactive accent on light backgrounds |
| `navy-300` | `#8FB4DC` | Borders and dividers on light |
| `navy-100` | `#DCE7F4` | Tinted panel background |
| `navy-050` | `#F2F6FB` | Faintest wash |

### Neutrals

Warm, slightly off-white — paper rather than screen-white. This is what keeps the product
feeling academic instead of generic SaaS.

| Token | Hex | Use |
| --- | --- | --- |
| `parchment` | `#FDFBF7` | Page background |
| `ink` | `#141821` | Body text |
| `ink-muted` | `#5A6377` | Secondary text, captions |

### Accent — unconfirmed

| Token | Hex | Use |
| --- | --- | --- |
| `gold` | `#C9A227` | Primary action, focus ring, readiness indicators |

Gold is the conventional academic partner to navy and it clears WCAG AA on `navy-700`.
But it is **invented here**, not taken from the logo. If Academia Scribes has a real
accent colour, this is the first thing to replace.

### Semantic

| Token | Hex | Use |
| --- | --- | --- |
| `success` | `#1E7A5A` | Ready, correct, passed |
| `warning` | `#B5761E` | Needs review, weak area |
| `danger` | `#A62B2B` | Failed, destructive action |

## Typography — blocked, see below

The logo embeds two subsetted fonts:

```
JKKAQQ+FONTSPRINGDEMO-BiennaleMediumRegular
IELBET+FONTSPRINGDEMO-BiennaleLightRegular
```

`FONTSPRINGDEMO` is the giveaway. These are **Fontspring demo/trial cuts of Biennale**,
which are licensed for evaluation only — not for a commercial product, not for web
embedding, and not for redistribution. Shipping them in a paid SaaS would be a licensing
violation, and the demo files are usually character-subsetted anyway, so they would break
on real content.

This does not affect the logo artwork itself — the type in it is already converted to
vector outlines, so the PDF is safe to use as-is. It only blocks using Biennale as a
**UI typeface**.

Three ways forward, in order of preference:

1. **Buy a Biennale licence** (Fontspring, by Kimmy Design) — keeps the UI matched to the
   logo exactly.
2. **Use a free lookalike.** Biennale is a geometric humanist sans; Poppins, Outfit, or
   Figtree sit close and are all SIL Open Font Licence.
3. **Deliberately contrast.** `CLAUDE.md` requires headings and body to use different
   fonts anyway, so pair a serif for headings with a clean sans for body and let the logo
   stand apart.

Nothing is wired into `globals.css` until this is decided.

## Still missing

- An SVG or PNG export of the logo. The PDF cannot be used in a web page, and cannot be
  recoloured in CSS. An `logo.svg` is the single most useful thing to add next.
- A mono/single-colour variant for dark or busy backgrounds.
- An icon-only mark for the favicon and small sizes.
