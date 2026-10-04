# Launch film — Version 2 (the story cut)

Version 1 (`launch-landscape.mp4`) is the visual foundation: real captured app
screens, browser-framed, panned, brand title cards. It reads as a polished demo.
Version 2 keeps the design language and the real footage but restructures
everything around a **narrative** so a first-time viewer feels:
*"This takes my research and helps me actually prepare to defend it."*

Positioning line for the whole piece: **Your research, turned into a defense partner.**

---

## Story arc

Pressure → Problem (work is scattered) → Transformation (it all comes together)
→ Ask → Defense-style questions → earned resolution → brand climax.

Pacing shape: **slow → accelerate → accelerate → climax → breathe.**

---

## Shot-by-shot (target ~38s, 30fps)

| # | Time | Beat | On screen | Motion / notes | Asset |
|---|------|------|-----------|----------------|-------|
| 1 | 0.0–2.0 | Fear | Off-white, small caps **YOUR DEFENSE IS TOMORROW**, screen slowly darkens to navy | very slow; ambient pulse later | title card (new) |
| 2 | 2.0–4.5 | Hook | **Would you be ready?** large Fraunces, centered, then a half-beat of black | hold, let it land | title card (new) |
| 3 | 4.5–9.0 | Problem | Document tiles drift in, slightly scattered: *Chapter 1 · Literature Review · Methodology · Results · References · Questionnaire · Notes* → line: **Your work is everywhere.** | tiles fade/slide in off-grid, gentle float | new CSS tiles (no screenshot) |
| 4 | 9.0–13.0 | Transformation (HERO) | Tiles get pulled to center, snap/stack, **whoosh**, resolve into the app → **Everything in one place.** | the one big metaphor moment: tiles converge (translate+scale) then the dashboard frame rises up behind them | tiles → `captures/01-dashboard.png` |
| 5 | 13.0–16.5 | Knowledge base | Dashboard/knowledge-base, caption **Your chapters become a knowledge base** · sub *5 chapters, indexed* | brief push-in on the "100% indexed / chapters" area | `03-project.png` / dashboard readiness |
| 6 | 16.5–21.0 | Ask (real question typed) | Ask screen, cursor types **"What are the limitations of my study?"** → "Reading your chapters…" → answer populates | type-on effect, then answer rises line by line, source chip "Chapter 5 · cited" | `04-ask-typed.png` + faithful answer panel* |
| 7 | 21.0–26.5 | Defense questions (mini-simulation) | Rapid, escalating question cards, each with **EXAMINER** tag: *What problem does your study address? → Why this methodology? → What are your key findings? → What are the limitations?* | quick cuts, one per ~1.3s, cards snap in | new cards from real DB questions |
| 8 | 26.5–30.5 | Practice / mark | Quiz correct-answer + source, then flashcard "Solid" — proof it marks you against your own work | short holds, subtle confirm pulse | `06-quiz-answered.png`, `05-flashcard-revealed.png` |
| 9 | 30.5–33.5 | Build to climax | Fast elegant montage of words: **Your work → Your knowledge → Your questions → Your answers**, then everything clears | each word ~0.5s, then wipe to navy | text montage (new) |
| 10 | 33.5–38.0 | Brand climax | Navy, logo, pause, **Defense, ready.** · *Understand it. Remember it. Practice it. Defend it.* · ACADEMIA SCRIBES | silence + soft deep impact | title card (reuse) |

\* **Ask answer note:** the live Ask endpoint currently errors server-side, so we
can't screen-capture a real generated answer. Beat 6 renders a faithful answer
panel built from the app's own components + the student's *real* stored content
(the Chapter 5 limitations answer, with the real "cited" source), so it's true to
the product and the project — not invented.

---

## What we reuse vs. build

- **Reuse:** all `captures/*.png`, the browser frame, brand title cards, fonts,
  the deterministic HTML→MP4 pipeline (`render.mjs`), navy/white system.
- **Build new:** document-tile problem scene + converge-to-center hero (beat 3–4),
  type-on Ask answer (beat 6), EXAMINER question cards (beat 7), word montage (beat 9),
  the darkening opening (beat 1).
- **Depth pass:** slow push-ins (scale 1.0→1.03), slight parallax between caption
  and frame, soft shadow. Transform/opacity only, per the pipeline.

## Text discipline
Big emotional lines (Fraunces) / medium explainers / small uppercase product
labels. Every scene readable in 1–2s. Cut long sub-captions to short ones.

## Sound design (added after picture locks)
Ambient low pulse (open) · paper/digital whoosh (tiles converge) · keyboard
clicks (typing) · soft confirm (answer) · ticks (quiz) · deep soft impact +
silence on the final logo. VO optional (see decisions).

## VO option (first-person, tells the story — does NOT narrate the UI)
> You spent months building your research. But when the questions come — will you
> remember it? Academia Scribes turns your project into your practice partner.
> Upload your work. Ask it anything. Practice like the panel. So when the defense
> comes… you're ready.

---

## Decisions to confirm before building
1. **Length:** ~38s (recommended, room to breathe) or hold to 35s?
2. **Voiceover:** text + SFX only, or add the VO above (you record via Google AI Studio)?
3. **Ask answer beat:** faithful recreation with your real limitations answer (recommended) — OK?
4. **Formats:** 16:9 first, then 9:16 vertical (and 4:5 feed?) — confirm which you need.
5. **Positioning line** on/near the CTA: "Your research, turned into a defense partner." — keep, change, or drop?

## Build order (tomorrow)
1. New scene modules (tiles, hero converge, EXAMINER cards, word montage) as
   separate blocks in a `composition-story.html`.
2. Wire the single 38s timeline; probe key frames.
3. Full render → contact sheet check → send.
4. Sound design pass.
5. 9:16 (and 4:5) cuts.

---

## Built (Oct 4): `story.html` → `story_final.mp4`

44.5s, 1920×1080, 30fps. Every sound in it is made in code: no sample packs and no stock music.

```bash
npm i
node render-story.mjs                      # picture -> story-silent.mp4
/opt/tts/bin/python vo_tts.py af_heart     # voice -> vo/NN.wav (Kokoro, open weights, runs locally)
python3 mix_story.py                       # score + SFX + VO -> story_final.mp4 (-14 LUFS, -1 dBTP)
```

- **Timing:** `story.py` holds the timing and the VO lines. The music runs at 112.5 bpm and the
  drop lands on the logo at 11.7s. The examiner cards, the montage words and the final hit all
  sit on that beat grid, and `story.html` uses the same numbers.
- **Real content:** the knowledge-base beat is the live project page (`captures/03-project.png`,
  cropped to `captures/project-real.jpg`). The chapter files and word counts, the quiz question
  and options, the Ask answer text and the first examiner question all come from the real
  neonatal jaundice project. The Ask panel is redrawn because the live Ask page returned
  "Search is unavailable right now" on Oct 4.
- **To swap the voice:** use a different Kokoro voice, e.g. `bm_george` or `af_bella`, or drop
  in a recorded take as `vo/NN.wav` files, one per line in `story.py`.
