# Launch motion graphic

A ten second launch film, rendered locally. No API, no credits, no per-render fee.

| File | Size | Use |
| --- | --- | --- |
| `launch-landscape.mp4` | 1920x1080 | Website, YouTube, presentations |
| `launch-portrait.mp4` | 1080x1920 | WhatsApp Status, Instagram, TikTok |
| `composition.html` | - | The source. Edit this, re-render. |

## Rendering

Needs Node 22+ and FFmpeg, both already installed here.

```bash
cd marketing/launch-motion
cp composition.html index.html
npx hyperframes@latest render . -o launch-landscape.mp4
```

For the portrait cut, swap the two dimensions on the stage element and render again:

```bash
sed -e 's/data-width="1920"/data-width="1080"/' \
    -e 's/data-height="1080"/data-height="1920"/' \
    composition.html > portrait/index.html
npx hyperframes@latest render ./portrait -o launch-portrait.mp4
```

## Why it is written rather than generated

It uses the real brand: the navy and gold from `Brand_Assest/palette.md`, the actual logo
mark with its A knockout, and the same Fraunces and Figtree pairing the app loads. A
generated video could only approximate those, and would cost credits every time a word
changed.

## Two things that will catch you out

**Dimensions live on the stage element, not on `<html>`.** Put them on the wrong element and
HyperFrames silently renders 1080x1920 instead, and a fixed-pixel layout overflows off the
frame.

**Everything is sized in `vmin`.** At 1920x1080 and at 1080x1920 the short axis is 1080
either way, so one set of values gives identical type size in both orientations. That is
what lets one composition serve both cuts.

## How it is animated

Plain CSS animations on a fixed timeline. HyperFrames sets the animation clock to each frame
and screenshots, so no JavaScript timers, no `requestAnimationFrame` and no randomness, or
frames stop being reproducible.
