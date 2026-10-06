"""Screen-recording beats for the follow-up reel: privacy blur by OCR, then a framed card with a
slow push-in, rendered to 1080x1920 SDR clips (converted to HLG at composite time).

    python3 followup/screens.py      -> work/followup/screen_<name>.mp4 + work/followup/blur_log.json

Privacy: every output frame is OCR'd (the scrolling rules on every frame, the static pages every few
frames). Words that are e-mail addresses, people's names or company names are blurred on the
source frame before it is cropped. Boxes from the neighbouring OCR frames are carried across, shifted
by the measured scroll, so a word the OCR misses on one frame still stays blurred.
"""
import os, json, re, subprocess, difflib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import pytesseract
import imageio_ffmpeg

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SRC = os.path.join(HERE, 'src/followup/screenity.mp4')
WORK = os.path.join(HERE, 'work/followup')
SW, SH, W, H, FPS = 1920, 1080, 1080, 1920, 30
CARD = (40, 270, 1000, 900)                       # x, y, w, h on the 1080x1920 frame (crop aspect 1.111)

SEGS = [
    # task page: name + "Next run ... 2:00 PM" + "Repeats Weekdays at 2:00 PM"; push in towards the schedule
    dict(name='task',  src=(27.0, 33.6),    out=(13.933, 21.2),  dark=True,  every=6,
         crop0=(530, 190, 870, 783), crop1=(1000, 420, 560, 504)),
    # rules modal scrolling under the Day 3 -> Stop timeline
    dict(name='rules', src=[(35.6, 41.35), (46.45, 50.0)],    out=(21.2, 30.9),    dark=True,  every=1,
         crop0=(525, 150, 870, 783), crop1=(525, 150, 870, 783)),
    # one sent follow-up, opened
    dict(name='gmail', src=(106.45, 108.9), out=(32.933, 35.933), dark=False, every=3,
         crop0=(330, 190, 1000, 900), crop1=(380, 240, 850, 765),
         fixed=[('profile photo', (334, 340, 398, 402)), ('profile photo', (334, 440, 398, 502))]),
]
NAMES = ['tolulope', 'fatoyinbo', 'tolu5776', 'eamonn', 'bowe']

def sensitive(tokens):
    hits = []
    for i, (t, box) in enumerate(tokens):
        lt = t.lower().strip('.,:;()<>"\'')
        if not lt: continue
        if re.search(r'\w{2,}@|@\w{2,}', lt) or re.search(r'\w\.(com|co|org|net|io)\b', lt):
            hits.append(('email', t, box)); continue
        if any(n in lt for n in NAMES) or (len(lt) >= 5 and any(difflib.SequenceMatcher(None, lt[:len(n) + 2], n).ratio() > .8 for n in NAMES)):
            hits.append(('name', t, box)); continue
        if lt.startswith('dental') and i and 'bowe' in tokens[i - 1][0].lower():
            hits.append(('company', t, box))
    return hits

def ocr(img, region, dark):
    x0, y0, w, h = region
    g = img.crop((x0, y0, x0 + w, y0 + h)).convert('L')
    if dark: g = Image.eval(g, lambda v: 255 - v)
    # faded text (the modal fades its top edge) -> stretch contrast line by line before OCR
    a = np.asarray(g, np.float32); rows = []
    for y0r in range(0, a.shape[0], 40):
        band = a[y0r:y0r + 40]; lo, hi = np.percentile(band, 2), np.percentile(band, 98)
        rows.append(np.clip((band - lo) / max(8, hi - lo) * 255, 0, 255) if hi - lo > 8 else band)
    g = Image.fromarray(np.vstack(rows).astype(np.uint8))
    g = g.resize((w * 2, h * 2), Image.LANCZOS)
    hits = []
    for psm in ('11', '6'):                       # sparse-text and block layouts miss different words; use both
        d = pytesseract.image_to_data(g, config=f'--psm {psm}', output_type=pytesseract.Output.DICT)
        toks = [(d['text'][i], (x0 + d['left'][i] / 2, y0 + d['top'][i] / 2, x0 + (d['left'][i] + d['width'][i]) / 2, y0 + (d['top'][i] + d['height'][i]) / 2))
                for i in range(len(d['text'])) if d['text'][i].strip()]
        for hgt in sensitive(toks):
            if not any(abs(hgt[2][0] - o[2][0]) < 12 and abs(hgt[2][1] - o[2][1]) < 8 for o in hits): hits.append(hgt)
    return hits

def scroll_dy(a, b):
    """vertical shift of b relative to a (pixels), by phase correlation on a centre strip"""
    A = np.asarray(a, np.float32); B = np.asarray(b, np.float32)
    F = np.fft.fft2(A) * np.conj(np.fft.fft2(B)); r = np.abs(np.fft.ifft2(F / (np.abs(F) + 1e-6)))
    dy, dx = np.unravel_index(np.argmax(r), r.shape)
    return -(dy if dy < A.shape[0] / 2 else dy - A.shape[0])

def ranges(seg):
    return [tuple(r) for r in seg['src']] if isinstance(seg['src'][0], (list, tuple)) else [tuple(seg['src'])]

def frames(seg):
    """frames at 30 fps over the output duration; several source ranges are joined (used where the
    recording pauses between two scrolls and nothing on screen changes, so the join is seamless)"""
    R = ranges(seg); n = round((seg['out'][1] - seg['out'][0]) * FPS)
    total = sum(b - a for a, b in R); speed = total / (seg['out'][1] - seg['out'][0])
    counts = [round((b - a) / speed * FPS) for a, b in R]; counts[-1] = n - sum(counts[:-1])
    i, last = 0, None
    for (s0, s1), cnt in zip(R, counts):
        p = subprocess.Popen([FF, '-v', 'error', '-ss', str(s0), '-t', str(s1 - s0 + .5), '-i', SRC, '-vf', f'setpts=PTS/{speed},fps={FPS}',
                              '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        for j in range(cnt):
            buf = p.stdout.read(SW * SH * 3)
            if len(buf) == SW * SH * 3: last = Image.frombuffer('RGB', (SW, SH), buf, 'raw', 'RGB', 0, 1).copy()
            yield i, n, last, round(s0 + j / FPS * speed, 2)
            i += 1
        p.kill()

def rounded(size, r):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255); return m

def render(seg, log):
    out = os.path.join(WORK, f"screen_{seg['name']}.mp4")
    enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', '-pix_fmt', 'yuv420p',
                            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], stdin=subprocess.PIPE)
    c0, c1 = np.array(seg['crop0'], float), np.array(seg['crop1'], float)
    # OCR a margin beyond what the card shows, so a word scrolling in is caught before it is visible
    rx0, ry0 = max(0, int(min(c0[0], c1[0])) - 30), max(0, int(min(c0[1], c1[1])) - 60)
    rx1, ry1 = min(SW, int(max(c0[0] + c0[2], c1[0] + c1[2])) + 30), min(SH, int(max(c0[1] + c0[3], c1[1] + c1[3])) + 60)
    region = (rx0, ry0, rx1 - rx0, ry1 - ry0)
    strip = lambda im: im.crop((region[0], region[1], region[0] + region[2], region[1] + region[3])).convert('L').resize((region[2] // 2, region[3] // 2))
    mask = rounded((CARD[2], CARD[3]), 28)
    prev_hits, prev_strip, prev_frame = [], None, None
    for i, n, im, src_t in frames(seg):
        st = strip(im)
        dy = 0 if prev_strip is None else scroll_dy(prev_strip, st) * 2
        # boxes from earlier OCR frames ride along with the scroll for a few frames (age-limited), so a word
        # the OCR misses on one frame is still covered
        carried = [(k, t, (b[0], b[1] + dy, b[2], b[3] + dy), age + 1) for k, t, b, age in prev_hits if age + 1 <= seg['every'] + 3]
        hits = [(k, t, b, 0) for k, t, b in ocr(im, region, seg['dark'])] if i % seg['every'] == 0 else []
        keep = hits + [h for h in carried if not any(abs(h[2][1] - g[2][1]) < 8 and abs(h[2][0] - g[2][0]) < 30 for g in hits)]
        keep = [h for h in keep if -40 < h[2][1] < SH + 40]
        boxes = [h[2] for h in keep] + [b for _, b in seg.get('fixed', [])]
        bl = im.copy()
        for b in boxes:
            x0, y0, x1, y1 = int(b[0]) - 6, int(b[1]) - 5, int(b[2]) + 6, int(b[3]) + 5
            x0, y0 = max(0, x0), max(0, y0)
            if x1 <= x0 or y1 <= y0: continue
            reg = bl.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(10)).filter(ImageFilter.GaussianBlur(10))
            bl.paste(reg, (x0, y0))
        t = round(seg['out'][0] + i / FPS, 3)
        log.append({'clip': seg['name'], 'out_t': t, 'src_t': src_t, 'what': sorted({f'{h[0]}: {h[1]}' for h in keep} | {f'{k}' for k, _ in seg.get('fixed', [])})})
        # composition: blurred, darkened backdrop of the same frame + the card with a slow push-in
        p = i / max(1, n - 1); e = p * p * (3 - 2 * p)
        cx, cy, cw, ch = c0 + (c1 - c0) * e
        card = bl.transform((CARD[2], CARD[3]), Image.EXTENT, (cx, cy, cx + cw, cy + ch), Image.BICUBIC)
        sm = bl.resize((96, 54)).filter(ImageFilter.GaussianBlur(3))
        sc = H / 54; bw = int(96 * sc)
        bg = sm.resize((bw, H), Image.BICUBIC).crop(((bw - W) // 2, 0, (bw - W) // 2 + W, H))
        bg = Image.eval(bg, lambda v: int(v * .38))
        shadow = Image.new('L', (W, H), 0); ImageDraw.Draw(shadow).rounded_rectangle((CARD[0], CARD[1] + 18, CARD[0] + CARD[2], CARD[1] + CARD[3] + 18), 30, fill=150)
        bg.paste(Image.new('RGB', (W, H), (0, 0, 0)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(26)))
        bg.paste(card, (CARD[0], CARD[1]), mask)
        ImageDraw.Draw(bg).rounded_rectangle((CARD[0], CARD[1], CARD[0] + CARD[2] - 1, CARD[1] + CARD[3] - 1), 28, outline=(70, 70, 70), width=2)
        enc.stdin.write(bg.tobytes())
        prev_hits, prev_strip = keep, st
        if i % 30 == 0: print(f"  {seg['name']} {i}/{n}  blurred {len(boxes)}", flush=True)
    enc.stdin.close(); enc.wait()
    print('->', out)

if __name__ == '__main__':
    import sys
    only = sys.argv[1:]
    log = []
    for seg in SEGS:
        if not only or seg['name'] in only: render(seg, log)
    path = os.path.join(WORK, 'blur_log.json')
    old = json.load(open(path)) if os.path.exists(path) and only else []
    old = [r for r in old if r['clip'] not in only]
    json.dump(old + log, open(path, 'w'), indent=0)
