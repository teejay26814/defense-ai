# Talking-head reel template

Turns a raw phone clip into a branded vertical reel. Every video gets:
- colour: iPhone HDR converted to SDR, plus the brand grade
- tight jump cuts with alternating punch-in zooms
- word-by-word captions in navy and electric blue
- a name lower-third and an end card
- a cleaned-up voice, a music bed and word-anchored SFX

```bash
python3 edit.py projects/intro-01.json      # -> out/intro-01.mp4 and out/intro-01_share.mp4 (<30 MB)
```

## A new video

1. Put the clip in `src/`. Footage is gitignored.
2. Transcribe it with word timings (faster-whisper, medium.en) into `work/<name>.words.json`.
3. Copy `projects/intro-01.json` and set these fields:
   - `keeps`: `[start, end, zoom]` in source seconds, with edges about 40 ms from speech; alternate the zoom on every cut.
   - `fix`: corrections for names the recogniser mishears.
   - `lines`: the caption lines, sentence by sentence; unlisted filler words are skipped.
   - `lower_third`, `end_card`, `music`.
   - `sfx`: anchored to events (`cut_in`, `lower`, `end`) or to a spoken `word`, never to raw times.
4. Run the pipeline. `--stage base|data|overlay|audio|final` re-runs a single step.

## Files

- `overlay.html`: the graphics layer. It is rendered to transparent frames by `render_overlay.mjs`.
- SFX and music come from the SAMADSMETT pack in `../motion-busywork/sfx`, which is not committed.
