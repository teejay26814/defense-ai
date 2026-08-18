# Brand assets

Drop the Academia Scribes brand assets in this folder. `CLAUDE.md` points here, so this is
the first place to look before designing anything.

> Note the folder spelling - `Brand_Assest`, not `Brand_Assets`. It is referenced by that
> name in `CLAUDE.md`. Renaming it means updating that reference too.

## What to put here

**Logo** - the important one.

- `logo.svg` is ideal: it scales cleanly and can be recolored in CSS.
- `logo.png` also works. Export at 3x the largest size it will be displayed at,
  on a transparent background.
- A PDF cannot be read in this environment, so a PDF-only logo effectively means no logo.
  If that is all you have, export it to SVG or PNG first.

If there are variants, name them plainly so they are unambiguous:

```
logo.svg              full lockup, primary colors
logo-mono.svg         single color, for dark or busy backgrounds
logo-mark.svg         just the icon, no wordmark - for favicons and small sizes
```

**Colors** - if there is a brand palette, add `palette.md` with the hex values and what
each one is for. For example:

```
Ink        #1A1A2E   body text, headings
Parchment  #FDFBF7   page background
Accent     #C9A227   primary action, focus rings
```

Until real values land here, any palette in `globals.css` is a working guess and will be
replaced.

**Fonts** - if specific typefaces are licensed for this brand, note the names here.
`CLAUDE.md` requires a display/serif paired with a clean sans; headings and body must not
share a font.

## How these get used

The palette becomes `@theme` tokens in `src/app/globals.css` - Tailwind 4 is configured
CSS-first, so there is no `tailwind.config.js`. Never use the default Tailwind palette
(`indigo-500`, `blue-600`, and friends) for brand surfaces.
