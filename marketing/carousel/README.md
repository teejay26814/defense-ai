# Launch carousel

A seven-slide launch carousel for Academia Scribes, rendered locally to PNG. No API, no
credits, no per-render fee — the same approach as `../launch-motion`, but static cards
instead of a film.

| File | Size | Use |
| --- | --- | --- |
| `out/slide-01.png` … `slide-07.png` | 2160×2700 (2× of 1080×1350, 4:5) | Instagram & LinkedIn carousel |
| `composition.html` | — | The source. Edit this, re-render. |
| `render.mjs` | — | Screenshots each `.slide` to a PNG. |
| `fonts/` + `fonts.css` | — | The real brand faces, embedded locally. |

## The seven slides

1. **Cover** — "If your defense was tomorrow, would you be ready?"
2. **The problem** — your panel has already read your project; almost nobody rehearses.
3. **01 · Understand** — Chapters 1–5 become a private, askable knowledge base.
4. **02 · Remember** — flashcards and mnemonics from your own project.
5. **03 · Practise** — real defense questions and quizzes, drilled.
6. **04 · Defend** — a mock panel and a readiness score you earn.
7. **CTA** — Understand · Remember · Practise · Defend → start today.

## Rendering

Needs Node 22+ and the headless Chromium already installed in this environment. From this
folder:

```bash
npm install      # one-off: pulls playwright-core (the driver only, no browser download)
npm run render   # writes out/slide-01.png … out/slide-07.png
```

`render.mjs` finds the Chromium under `PLAYWRIGHT_BROWSERS_PATH` (`/opt/pw-browsers`), waits
for `document.fonts.ready`, then screenshots each `.slide` element in turn.

## Why it is written rather than generated

It uses the real brand: the navy and gold from `Brand_Assest/palette.md`, the actual logo
mark with its A knockout, and the same Fraunces and Figtree pairing the app loads. A
generated set could only approximate those, and would cost credits every time a word changed.

## Editing

- **Copy** lives directly in the `<section class="slide">` blocks in `composition.html`.
- **Dimensions** are `--slide-w` / `--slide-h` at the top of the stylesheet. Change them once
  and every slide follows. For a 1:1 square set (1080×1080), set both to `1080px`.
- **Export scale** is `SCALE` in `render.mjs` (2 = 2160×2700). Instagram accepts up to 1080
  wide and downscales; 2× keeps the type crisp.
- **Fonts** are the OFL cuts of Fraunces and Figtree, downloaded once into `fonts/` and
  referenced by `fonts.css`. Nothing is fetched at render time, so a slide can never appear
  with fallback type.

## Two things that will catch you out

**Each `.slide` must be exactly the card.** `render.mjs` screenshots the element's own box, so
padding and overflow on `.slide` are the safe zone. Content that overflows the box is clipped
in the PNG, not scrolled.

**Fonts are local, not fetched.** If you add a weight, add its `@font-face` to `fonts.css` and
drop the `.woff2` in `fonts/` — do not switch to a Google Fonts `<link>`, or a render will
depend on the network and could produce a fallback frame.
