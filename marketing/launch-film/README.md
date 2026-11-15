# Launch film

A 38-second motion-design launch film with voiceover, original music and sound effects,
in two cuts: `academia-scribes-launch-16x9.mp4` (YouTube, LinkedIn, X) and
`academia-scribes-launch-9x16.mp4` (WhatsApp Status, Instagram Reels, TikTok).
Navy and white only.

| File | What it is |
| --- | --- |
| `film.html` | The animation. Every element is driven by `window.render(t)`, so any frame can be rendered exactly. Lays out for 16:9 or 9:16 from the viewport. |
| `render.js` | Renders every frame with Playwright: `node render.js 1920 1080 frames_L` (or `1080 1920 frames_P`). |
| `sound.py` | Synthesises the score and sound effects (no samples, no licences), ducks the music under the voice and writes `mix.wav`: `python3 sound.py assets/voiceover.wav audio`. Needs numpy and scipy. |
| `assets/voiceover.wav` | The narration: ElevenLabs voice "Brooks" via Higgsfield, 48 kHz mono. |
| `assets/ask_crop.png` | The real Ask-my-project answer shown in the film. |

## Rebuilding

```bash
python3 sound.py assets/voiceover.wav audio
node render.js 1920 1080 frames_L
ffmpeg -framerate 30 -i frames_L/%05d.jpg -i audio/mix.wav -c:v libx264 -crf 17 -pix_fmt yuv420p \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 256k -shortest -movflags +faststart \
  academia-scribes-launch-16x9.mp4
```

Scene timings in `film.html` and `sound.py` are matched to the voiceover (it starts at 0.8 s).
If the narration is regenerated, re-measure the sentence starts and move both together.

## Grand cut (film2)

42-second trailer version: letterbox, logo slam with light rays, crisp mask text reveals, trailer score (braams, toms, ticking clock).
Voice is free and local: Kokoro TTS (`kokoro-onnx`), a 70/30 blend of `am_michael` and `am_onyx`, one line per file in `assets/vo-lines/`.

    python3 sound2.py assets/vo-lines audio2   # score, sfx, voice processing and mix
    bash build2.sh                              # renders both orientations at 2x, encodes, loudness -14 LUFS

`render2.js` reads `FILM`, `DUR`, `DPR` and `Q` from the environment.
