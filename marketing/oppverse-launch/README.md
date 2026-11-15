# Oppverse AI — launch film

A 53-second, 1920×1080 launch film for **Oppverse AI** (oppverseai.vercel.app). Everything is
built in HTML/CSS and rendered frame by frame, so each frame is exact and repeatable.

## Brand system (taken from the live site)

| Token | Value |
|---|---|
| Canvas | `#0a0a0a`; surfaces `#101010` / `#151515`; border `#29292d` |
| Text | `#fafafa`, `#d4d4d8`, muted `#a1a1aa`, subtle `#71717a` |
| Accent | violet `#8272e8` (strong `#aaa0f4`) |
| States | success `#55b982`, warning `#d3a74f`, danger `#d87575` |
| Type | **Sora 600** display, **Inter** UI, JetBrains Mono for data (the site uses ui-monospace) |
| Icons | Lucide, the same set the site uses |
| Mark | Redrawn as vector from the site's 64px icon: a slab and three speed stripes |

All product copy is the site's own. This covers:
- the hero line
- the 8 universes and their counts
- the 5-layer engine (Eligibility Fit, Skill Fit, Goal Alignment, Funding Coverage, Application Effort)
- the three sample opportunity cards
- the process copy and the closing line

The sample profile values in scene 4 are illustrative: 6 years, Lagos, and so on.

## Story (music bar grid: 1.78s; the track's drop lands on the logo)

| Time | Scene | Beat |
|---|---|---|
| 0.0 | The problem | Scattered tabs, portals, newsletters, closed deadlines, "not eligible" chips. "It's buried across 50 websites. And it closes before you find it." |
| 6.4 | The turn | The noise collapses to a point of light, which becomes a horizon. "Opportunity should find the right person." |
| 10.4 | Logo | On the drop. |
| 14.0 | 01 Profile | "Build your profile once." A profile card builds, verified, 100%; persona switch (Professional → Founder). |
| 21.1 | 02 Universes | "One profile. Every opportunity universe." 8 universes orbit the core, and the counts roll. The camera dives into Fellowships. |
| 28.2 | 03 Matching | "Every match, explained." The Mozilla card sits beside a 5-layer breakdown counting to 92%; a listing is screened out for a citizenship restriction. |
| 35.3 | 04 Live feed | "Ranked for you. Live." The site's universe view: cards arrive unranked, then sort to 92 / 89 / 86. |
| 40.7 | 05 Pipeline | "From discovery to decision." Save → Compare → Tailor → Track → Accepted. |
| 44.2 | Close | "Stop searching everywhere. Start seeing what fits." Logo, then the CTA. |

## Build

```bash
npm i
node render.mjs                    # picture -> oppverse-launch.mp4 (silent)
node render.mjs --probe 10.9 29.4  # check single frames -> probe/
python3 mix.py                     # music + SFX -> oppverse-launch_final.mp4, stems/ (music, sfx, mix)
python3 mix.py --vo voice.wav      # adds the voice-over and ducks the music under it
```

- **Music:** `mixkit-21-445`, started 3.8s into the track.
- **SFX:** from the SAMADSMETT SFX pack in `../motion-busywork/sfx`, which is not committed.
- **Cue placement:** every cue in `mix.py` is placed by the file's measured peak, so hits land on their frame.
- **Master:** -14 LUFS, -1 dBTP.
