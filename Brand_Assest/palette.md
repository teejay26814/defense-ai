# Palette

## Extracted from the logo

These are measured values, not guesses. `Academia Scribes Logo.pdf` could not be rendered
(`poppler-utils` is not installed), but its content streams were parsed directly: the
colour space is `ICCBased` with `N 3`, so the operands below are true RGB.

| Hex | Source | Where it appears in the logo |
| --- | --- | --- |
| `#052659` | `0.0196 0.149 0.349 scn` | The full-bleed 432×432 background square |
| `#FFFFFF` | `1 1 1 scn` | The mark and the wordmark |
| `#000000` | `0 0 0 scn` | 5 uses, inside an optional-content group - almost certainly a mask, not a brand colour |

The artwork is 432×432pt (6in square) and fully vector - there are no raster images in it,
and no colour beyond the three above. So the brand as delivered is **navy and white**.

## Working palette

Only `#052659` and `#FFFFFF` come from the logo. Everything else below is derived from
that navy and is a **proposal** - it is the honest minimum needed to build a UI, not
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

Warm, slightly off-white - paper rather than screen-white. This is what keeps the product
feeling academic instead of generic SaaS.

| Token | Hex | Use |
| --- | --- | --- |
| `parchment` | `#FDFBF7` | Page background |
| `ink` | `#141821` | Body text |
| `ink-muted` | `#5A6377` | Secondary text, captions |

### Accent - unconfirmed

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

## Typography - blocked, see below

The logo embeds two subsetted fonts:

```
JKKAQQ+FONTSPRINGDEMO-BiennaleMediumRegular   → /F16, used for "Academia"
IELBET+FONTSPRINGDEMO-BiennaleLightRegular    → /F23, used for "Scribes"
```

Both are set at 29.25pt, starting at x=180 with the second line offset by (-18.19, -27.89).

`FONTSPRINGDEMO` is the giveaway. These are **Fontspring demo/trial cuts of Biennale**,
which are licensed for evaluation only - not for a commercial product, not for web
embedding, and not for redistribution. Shipping them in a paid SaaS would be a licensing
violation, and the demo files are usually character-subsetted anyway, so they would break
on real content.

**This affects the logo file itself, not just the UI.** The wordmark in the PDF is *live
text*, not outlines - the content streams show `Tj` operators drawing glyph IDs through
`/F16` and `/F23`. So "Academia Scribes" in the artwork is rendered by an unlicensed demo
font that happens to be embedded. The book mark is unaffected: it is genuine vector paths
and has been extracted to SVG (see below).

Resolving the font question therefore produces a corrected logo file too, not just a UI
decision.

Three ways forward, in order of preference:

1. **Buy a Biennale licence** (Fontspring, by Kimmy Design) - keeps the UI matched to the
   logo exactly.
2. **Use a free lookalike.** Biennale is a geometric humanist sans; Poppins, Outfit, or
   Figtree sit close and are all SIL Open Font Licence.
3. **Deliberately contrast.** `CLAUDE.md` requires headings and body to use different
   fonts anyway, so pair a serif for headings with a clean sans for body and let the logo
   stand apart.

Nothing is wired into `globals.css` until this is decided.

## Extracted SVG assets

The PDF has **4 pages**, all 432×432pt, all vector, no raster images, no hidden layers
(`/OFF[]` is empty). The four are colour variants of one lockup:

| Page | Background | Mark | Outline detail |
| --- | --- | --- | --- |
| 1 | `#052659` navy | white | 65-point |
| 2 | white | `#000000` black | 65-point |
| 3 | `#052659` navy | white | 135-point |
| 4 | white | `#052659` navy | 135-point |

The book mark was converted straight from the PDF path operators (`m l c h f*`, even-odd
fill, with the PDF y-up axis flipped to SVG y-down). It occupies x[110.2–155.0],
y[187.3–247.1] on the page - 44.75 × 59.75pt.

| File | Fill | Notes |
| --- | --- | --- |
| `logo-mark.svg` | `currentColor` | **Use this one.** Inherits CSS colour, so one file serves every context |
| `logo-mark-navy.svg` | `#052659` | Fixed navy |
| `logo-mark-white.svg` | `#FFFFFF` | Fixed white, for navy or photographic backgrounds |
| `logo-mark-simple.svg` | `currentColor` | The 65-point outline from pages 1–2, for comparison |

`src/app/icon.svg` is `logo-mark-navy.svg` padded to a square - Next.js picks it up
automatically as the favicon.

The mark is a book with the letter **A** knocked out of it (an even-odd counter, not a
separate shape), page-lines striping the top, and a solid spine down the left edge.
Because the A is a knockout, the mark reads correctly at any single colour.

## Still missing

- **The wordmark.** Only the book mark could be extracted; "Academia Scribes" is live text
  bound to the unlicensed demo font, so it is not in any of the SVGs above. Once the font
  question is settled, the wordmark can either be set in the licensed face or converted to
  outlines and exported.
- A full lockup SVG (mark + wordmark), which depends on the above.
- Confirmation of which outline is canonical - the 65-point or the 135-point mark.
