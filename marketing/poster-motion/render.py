"""Animate the Prophetic Worship poster from its own layers.

    python3 layers.py && python3 render.py [--preview t1,t2,...]

Output: out/prophetic-worship.mp4, 1080x1440 (3:4), 30 fps, 12 s.

Every pixel comes from the poster: the background plate, the keyed white artwork with its
own colours, the portraits untouched. Effects only move, light or reveal those pixels, and
every added light is a colour sampled from the poster itself.
"""
import sys, os, math, subprocess
import numpy as np, cv2
import imageio_ffmpeg

W, H, FPS, DUR = 1080, 1440, 30, 12.0
FF = imageio_ffmpeg.get_ffmpeg_exe()
rd = lambda p: cv2.imread(p)[..., ::-1].astype(np.float32) / 255.0
PLATE, CLEAN, FG = rd('work/plate.png'), rd('work/poster_clean.png'), rd('work/fg.png')
L = np.load('work/layers.npz')
A = {k: L[k].astype(np.float32) for k in ['logo', 'presents', 'title', 'scripture', 'details', 'dove']}
GID, GLINE = L['glyph_id'], L['glyph_line']

# colours sampled from the artwork
lum = PLATE.mean(2)
hot = (lum > 0.72) & (PLATE[..., 0] - PLATE[..., 2] > 0.45)
GOLD = np.median(PLATE[hot], 0)                                   # the poster's bright amber-gold
IVORY = np.median(FG[A['title'] > 0.95], 0)                       # the title's own ivory
EMBER = np.median(PLATE[(lum > 0.35) & (lum < 0.55)], 0)          # mid orange-brown
print('sampled gold', GOLD.round(3), 'ivory', IVORY.round(3), 'ember', EMBER.round(3))

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
def smooth(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def ease_out(x): x = np.clip(x, 0, 1); return 1 - (1 - x) ** 3
def ease_io(x): x = np.clip(x, 0, 1); return 0.5 - 0.5 * math.cos(math.pi * x)
def screen(a, b): return 1 - (1 - a) * (1 - b)
def over(base, col, a): return base * (1 - a[..., None]) + col * a[..., None]
def affine(img, s=1.0, cx=W / 2, cy=H / 2, dx=0.0, dy=0.0, rot=0.0, border=cv2.BORDER_REFLECT):
    M = cv2.getRotationMatrix2D((cx, cy), rot, s); M[0, 2] += dx; M[1, 2] += dy
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=border)

# regions
BAND_TOP = 945                                                    # portraits start here
upper = smooth((BAND_TOP + 10 - yy) / 60)                         # 1 above the portrait band, fades out over it
band = smooth((yy - (BAND_TOP - 150)) / 190)                     # the lower picture, softly, from above the heads down
lower = smooth((yy - 1262) / 22)                                  # below the names: the event-details strip

# 1. the rings: centre and band-pass structure of the existing concentric arcs
RC = (545.0, 625.0)
rr = np.sqrt(((xx - RC[0]) / 1.12) ** 2 + (yy - RC[1]) ** 2)
plum = PLATE.mean(2)
ring_struct = np.clip((cv2.GaussianBlur(plum, (0, 0), 3) - cv2.GaussianBlur(plum, (0, 0), 14)) * 5, 0, 1)
ring_struct *= smooth((rr - 150) / 60) * smooth((680 - rr) / 80) * upper
RING_LAYER = PLATE * ring_struct[..., None]

# 2. the light textures: bright streaks of the plate itself, softened, to drift along their own direction
bright = np.clip((lum - 0.55) / 0.4, 0, 1)
LIGHT = cv2.GaussianBlur(PLATE * bright[..., None], (0, 0), 6)
STREAK = np.array([math.cos(math.radians(-24)), math.sin(math.radians(-24))], np.float32)   # lower-left to upper-right

# 3. glyphs of the title, each with its own box
glyphs = []
for gi in range(1, int(GID.max()) + 1):
    m = (GID == gi).astype(np.float32) * A['title']
    ys, xs = np.nonzero(m > 0.01)
    x0, x1, y0, y1 = xs.min() - 12, xs.max() + 12, ys.min() - 40, ys.max() + 12
    glyphs.append(dict(a=m[y0:y1, x0:x1], c=FG[y0:y1, x0:x1], box=(x0, y0, x1, y1), line=int(GLINE[gi - 1])))
TITLE_BLOOM = cv2.GaussianBlur(A['title'], (0, 0), 22)
TITLE_BLOOM /= TITLE_BLOOM.max()
TZ = cv2.GaussianBlur(cv2.dilate((A['title'] > 0.03).astype(np.float32), np.ones((35, 35), np.uint8)), (0, 0), 10)
TITLE_FIELD = cv2.GaussianBlur(cv2.dilate((A['title'] > 0.03).astype(np.float32), np.ones((41, 41), np.uint8)), (0, 0), 30)

# 4. portraits: eight soft columns, revealed from the host outward
PX = [40, 178, 318, 470, 620, 765, 900, 1032]
cols = np.stack([np.exp(-((xx[0] - c) / 62.0) ** 2) for c in PX]); cols /= cols.sum(0, keepdims=True)
ORDER = [4, 3, 5, 2, 6, 1, 7, 0]                                  # Minister Joel (host, centre) first

DOVE_A, DOVE_C = A['dove'], FG
DOVE_GLOW = cv2.GaussianBlur(DOVE_A, (0, 0), 16)
DC = (190.0, 390.0)                                               # dove centre, for its float and turn

def frame(t):
    # background: slow flow, breathing light, travelling light, ring pulse and echo
    k = 2 * math.pi
    # once the title has formed, the poster's own texture returns behind and between the letters
    back = smooth((t - 2.9) / 0.9)
    src_img = PLATE if back <= 0 else PLATE * (1 - back * TZ[..., None]) + CLEAN * (back * TZ)[..., None]
    still = upper * (1 - TZ)                                       # nothing drifts under the type
    dx = (2.6 * np.sin(k * (yy / 520 + t / 7.0)) + 1.4 * np.sin(k * (xx / 380 - t / 5.3))) * still
    dy = (2.0 * np.sin(k * (xx / 610 + t / 6.1)) + 1.2 * np.cos(k * (yy / 300 + t / 4.7))) * still
    bg = cv2.remap(src_img, xx + dx, yy + dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    breathe = 1 + 0.05 * math.sin(k * t / 5.0) * bright * upper
    bg = bg * breathe[..., None]
    drift = STREAK * (t * 16.0)
    lt = affine(LIGHT, dx=float(drift[0]), dy=float(drift[1]))
    lt2 = affine(LIGHT, dx=float(drift[0] - 140), dy=float(drift[1] + 62))
    wob = 0.5 + 0.5 * math.sin(k * t / 6.0)
    sweep_mask = smooth(1 - np.abs((xx * 0.9 - yy * 0.42) - (-350 + t * 115)) / 520) * upper
    bg = screen(bg, (lt * (0.16 + 0.08 * wob) + lt2 * 0.10) * (0.55 + 0.45 * sweep_mask[..., None]) * upper[..., None])
    # rings: a soft light pulse travels outward every 4 s, and the arcs breathe outward in an echo
    if t > 0.3:
        ph = ((t - 0.3) % 4.0) / 4.0
        R = 150 + ph * 560
        pulse = np.exp(-((rr - R) / 38.0) ** 2) * (1 - ph) ** 0.6
        bg = bg * (1 + 0.55 * (pulse * ring_struct)[..., None]) + GOLD * (0.10 * pulse * ring_struct)[..., None]
        echo = affine(RING_LAYER, s=1 + 0.035 * ease_out(ph), cx=RC[0], cy=RC[1], border=cv2.BORDER_CONSTANT)
        bg = screen(bg, echo * (0.32 * (1 - ph) * smooth(ph * 6)))
    # portraits: dark until each is lit in turn, with a brief, restrained catch of light
    lvl = np.zeros(W, np.float32)
    for n, ci in enumerate(ORDER):
        p = ease_out((t - 4.1 - n * 0.16) / 0.8)
        catch = 0.10 * math.sin(math.pi * np.clip((t - 4.1 - n * 0.16) / 0.9, 0, 1))
        lvl += cols[ci] * (0.22 + 0.78 * p + catch)
    strip = 0.22 + 0.78 * ease_out((t - 5.6) / 1.0)
    lvl2 = lvl[None, :] * (1 - lower) + strip * lower
    gain = 1 + (lvl2 - 1) * band
    img = bg * gain[..., None]
    # a faint ember light rising behind the portraits as they come up
    rise = smooth((t - 3.8) / 1.6) * (1 - 0.35 * smooth((t - 6.5) / 2))
    img = screen(img, EMBER * (0.10 * rise * np.exp(-((yy - 1000) / 90) ** 2) * (1 - band * 0.6))[..., None])

    # logo
    p = ease_out((t - 0.35) / 0.9)
    if p > 0:
        a = affine(A['logo'], s=0.965 + 0.035 * p, cx=545, cy=198, border=cv2.BORDER_CONSTANT) * p
        c = affine(FG, s=0.965 + 0.035 * p, cx=545, cy=198)
        glow = cv2.GaussianBlur(a, (0, 0), 10) * (0.35 * math.sin(math.pi * np.clip((t - 0.35) / 1.4, 0, 1)))
        img = screen(img, GOLD * glow[..., None])
        img = over(img, c, a)
    # "PRESENTS"
    p = ease_out((t - 0.85) / 0.7)
    if p > 0:
        img = over(img, affine(FG, dy=10 * (1 - p)), affine(A['presents'], dy=10 * (1 - p), border=cv2.BORDER_CONSTANT) * p)

    # dove: arrives, then floats with a soft glow
    p = ease_out((t - 0.9) / 1.2)
    if p > 0:
        fy = 7 * math.sin(k * t / 4.2); fx = 3 * math.sin(k * t / 5.5 + 1.0); rot = 1.3 * math.sin(k * t / 6.3)
        s = 0.94 + 0.06 * p
        args = dict(s=s, cx=DC[0], cy=DC[1], dx=fx - 36 * (1 - p), dy=fy + 10 * (1 - p), rot=rot)
        da = affine(DOVE_A, border=cv2.BORDER_CONSTANT, **args) * p
        dc = affine(DOVE_C, **args)
        g = affine(DOVE_GLOW, border=cv2.BORDER_CONSTANT, **args) * p * (0.30 + 0.08 * math.sin(k * t / 3.1))
        img = screen(img, IVORY * g[..., None])
        img = over(img, dc, da)

    # title: bloom of warm light, glyphs rise into place one by one, then a golden sweep
    # the light gathers where the title will be, the letters form inside it, then it settles
    field = 0.62 * smooth((t - 0.25) / 0.9) * (1 - smooth((t - 1.9) / 1.3))
    if field > 0:
        img = screen(img, GOLD * (TITLE_FIELD * field)[..., None])
    bloom = 0.40 * math.sin(math.pi * np.clip((t - 0.9) / 2.6, 0, 1)) + 0.14 * smooth((t - 2.4) / 0.8)
    bloom *= 1 + 0.10 * math.sin(k * t / 4.0)
    tscale = 1.0                                                  # stays registered to the artwork behind it
    if bloom > 0:
        img = screen(img, GOLD * (TITLE_BLOOM * bloom)[..., None])
    tl = np.zeros((H, W), np.float32); tc = np.zeros((H, W, 3), np.float32)
    nline = [0, 0]
    for g in glyphs:
        i = nline[g['line']]; nline[g['line']] += 1
        t0 = (0.95 if g['line'] == 0 else 1.5) + i * 0.075
        p = ease_out((t - t0) / 0.6)
        if p <= 0: continue
        x0, y0, x1, y1 = g['box']
        a = g['a']
        if p < 1:
            sh = 30 * (1 - p)
            M = np.float32([[1, 0, 0], [0, 1, sh]])
            a = cv2.warpAffine(a, M, (a.shape[1], a.shape[0]), borderMode=cv2.BORDER_CONSTANT)
            b = 7 * (1 - p)
            if b > 0.4: a = cv2.GaussianBlur(a, (0, 0), b)
            a = a * smooth(p * 1.6)
        tl[y0:y1, x0:x1] = np.maximum(tl[y0:y1, x0:x1], a)
        tc[y0:y1, x0:x1] = np.where((a > 0.001)[..., None], g['c'], tc[y0:y1, x0:x1])
    if tl.max() > 0:
        tl = affine(tl, s=tscale, cx=545, cy=650, border=cv2.BORDER_CONSTANT)
        tc = affine(tc, s=tscale, cx=545, cy=650)
        for s0, s1 in [(3.15, 4.25), (8.7, 9.8)]:                   # the golden light sweep across the letters
            q = (t - s0) / (s1 - s0)
            if 0 < q < 1:
                xs = 150 + q * 820
                band_s = np.exp(-(((xx - xs) + (yy - 650) * 0.36) / 46.0) ** 2) * math.sin(math.pi * q)
                tc = tc * (1 - 0.35 * band_s[..., None]) + GOLD * (0.35 * band_s)[..., None] + 0.25 * band_s[..., None]
        img = over(img, np.clip(tc, 0, 1), tl)
    # scripture
    p = ease_out((t - 3.5) / 0.7)
    if p > 0:
        img = over(img, FG, A['scripture'] * p)
    # event details: fade, then a light accent travels along them
    p = ease_out((t - 6.0) / 0.8)
    if p > 0:
        c = FG.copy()
        q = (t - 6.7) / 1.1
        if 0 < q < 1:
            xs = 60 + q * 980
            gl = np.exp(-((xx - xs) / 40.0) ** 2) * math.sin(math.pi * q)
            c = c * (1 - 0.4 * gl[..., None]) + GOLD * (0.4 * gl)[..., None] + 0.15 * gl[..., None]
        img = over(img, np.clip(c, 0, 1), A['details'] * p)

    # camera: a slow, steady push over the whole piece
    img = affine(np.clip(img, 0, 1), s=1 + 0.016 * ease_io(t / DUR), cx=540, cy=700)
    # open from black and settle
    img *= smooth(t / 0.45)
    return img

def to8(img): return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    if '--preview' in sys.argv:
        ts = [float(x) for x in sys.argv[sys.argv.index('--preview') + 1].split(',')]
        for t in ts:
            cv2.imwrite(f'work/prev_{t:05.2f}.png', to8(frame(t))[..., ::-1]); print('preview', t)
        sys.exit()
    out = 'out/prophetic-worship.mp4'
    p = subprocess.Popen([FF, '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                          '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], stdin=subprocess.PIPE)
    N = int(DUR * FPS)
    for i in range(N):
        p.stdin.write(to8(frame(i / FPS)).tobytes())
        if i % 60 == 0: print(f'{i}/{N}', flush=True)
    p.stdin.close(); p.wait(); print('->', out)
