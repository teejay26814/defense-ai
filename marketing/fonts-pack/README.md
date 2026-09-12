# Font pack

Ready-to-use fonts for video edits and graphics. All **OFL-licensed** — free for
personal *and* commercial use. Real `.ttf` files, so they work both in the HTML/CSS
motion pipeline (`@font-face`, see `fonts.css`) and directly in **ffmpeg drawtext**
for burning text onto uploaded videos.

| Use | Family | Files |
| --- | --- | --- |
| **Bold / attention-grabbing** | Anton | `Anton-Regular.ttf` |
| **Clean / easy to read** | Montserrat | `Montserrat-Regular / -SemiBold / -ExtraBold.ttf` |
| **Personal / handwritten** | Caveat | `Caveat-Medium / -Bold.ttf` |
| **Focus / elegant serif** | EB Garamond | `EBGaramond-Regular / -SemiBold.ttf` |

`specimen.png` shows all four.

## Notes on the two you named that we can't ship

- **Helvetica** — proprietary/paid, can't be downloaded. Free stand-in: **Arimo**
  (metrically identical to Helvetica/Arial) or **Inter**. Upload your own licensed
  Helvetica file and it can be used instead.
- **Garamond** (Adobe/Monotype) — paid. **EB Garamond** here is the free equivalent.

## Using them on a video (ffmpeg)

```bash
ffmpeg -i clip.mp4 -vf "drawtext=fontfile=marketing/fonts-pack/Anton-Regular.ttf:\
text='SAVE TIME AND MONEY':fontcolor=white:fontsize=90:x=(w-tw)/2:y=h-220" out.mp4
```

## Using them in the HTML motion pipeline

```html
<link rel="stylesheet" href="../fonts-pack/fonts.css" />
<style> h1 { font-family: "Anton"; } .body { font-family: "Montserrat"; } </style>
```

## Adding more

More free families are one download away (Oswald, Archivo Black, Poppins, Inter,
Arimo, Permanent Marker, Shadows Into Light, Kalam, …). Just ask.
