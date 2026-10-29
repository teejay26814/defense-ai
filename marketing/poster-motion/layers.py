"""Split the poster into its own layers, all cut from the original pixels.

    python3 layers.py            -> work/layers.npz, work/plate.png, work/check_*.png

The white artwork (title, dove, logo, "PRESENTS", scripture, names, event details) is keyed
out of the warm background by colour: ivory and white have little gap between red and blue,
while every orange, gold and brown in the poster has a large one. Each element keeps the
poster's own pixels with that soft alpha. The background plate is the same poster with those
elements removed and the holes filled from their surroundings, so letters and the dove can
move without leaving a ghost behind them.
"""
import numpy as np, cv2

W, H = 1080, 1440
src = cv2.imread('work/poster_1080.png')                       # BGR, 1080x1440
f = src.astype(np.float32) / 255.0
B, G, R = f[..., 0], f[..., 1], f[..., 2]

def ramp(x, a, b):                                             # 0 below a, 1 above b
    return np.clip((x - a) / (b - a), 0, 1)

def box(x0, y0, x1, y1):
    m = np.zeros((H, W), np.float32); m[y0:y1, x0:x1] = 1; return m

# White type on this poster is pure ivory (blue channel near 1.0) while every warm tone behind
# it sits near 0. So: find the solid strokes (blue > 0.6), grow them a few pixels to take in
# the anti-aliased edges, and take a soft alpha from the blue channel inside that region.
def key(x0, y0, x1, y1, core=0.62, lo=0.16, hi=0.86, grow=5, neutral=0.42, min_area=12, gmin=0.0):
    m = box(x0, y0, x1, y1)
    solid = ((B > core) & ((R - B) < neutral) & (G > gmin) & (m > 0)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid, 8)
    keep = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= min_area])
    region = cv2.dilate(keep.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1,) * 2))
    return ramp(B, lo, hi) * region * m

E = {}
E['logo']      = key(450, 135, 640, 262)
E['presents']  = key(375, 372, 700, 418, min_area=6)
E['title']     = key(205, 445, 880, 860, core=0.40, lo=0.12, hi=0.80, neutral=0.75, gmin=0.62, min_area=1500, grow=4)
E['scripture'] = key(818, 735, 915, 808, min_area=2)
E['details']   = key(60, 1272, 1020, 1368)
# the dove: white and grey feathers (neutral, fairly bright), feet and eye included by closing
dv = box(15, 215, 360, 560) * (1 - cv2.dilate((E['title'] > 0.05).astype(np.uint8), np.ones((15, 15), np.uint8)))
core = ((B > 0.55) & ((R - B) < 0.30) & (dv > 0)).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(core, 8)
big = (lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)
body = cv2.morphologyEx(big, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
region = cv2.dilate(body, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
soft = ramp(B, 0.30, 0.70) * ramp(0.55 - (R - B), 0.0, 0.25)
E['dove'] = np.maximum(soft * region, cv2.erode(body, np.ones((5, 5), np.uint8)).astype(np.float32)) * dv

# the "4/4" carousel badge is Instagram's interface, not the poster: fill it in
badge = np.zeros((H, W), np.uint8)
cv2.ellipse(badge, (992, 76), (58, 44), 0, 0, 360, 255, -1)

# background plate: remove every element that moves or fades, then fill the holes
hole = np.zeros((H, W), np.uint8)
for k in ['logo', 'presents', 'title', 'scripture', 'dove', 'details']:
    hole |= (E[k] > 0.05).astype(np.uint8) * 255
hole = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))) | badge
hole |= cv2.dilate(((E["title"] > 0.03) * 255).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
# fill at half size (smoother, more painterly), then put back the untouched pixels exactly
# fill by normalised convolution: each hole pixel takes a weighted average of the surrounding
# artwork, at the smallest scale that has enough real pixels nearby. This gives smooth warm
# light, like the glow already behind the type, instead of smeared blotches.
known = (hole == 0).astype(np.float32)
fs = src.astype(np.float32)
fill = np.zeros_like(fs); done = np.zeros((H, W), np.float32)
for sg in [5, 12, 26, 55, 110, 220]:
    den = cv2.GaussianBlur(known, (0, 0), sg)
    est = cv2.GaussianBlur(fs * known[..., None], (0, 0), sg) / np.maximum(den, 1e-4)[..., None]
    ok = (np.clip((den - 0.12) / 0.2, 0, 1) if sg < 220 else np.ones_like(den)) * (1 - done)
    fill += est * ok[..., None]; done += ok
fill = cv2.GaussianBlur(fill, (0, 0), 3)
fill += np.random.default_rng(1).normal(0, 1.6, fill.shape).astype(np.float32)   # break up banding
hm = cv2.GaussianBlur(cv2.dilate(hole, np.ones((7, 7), np.uint8)).astype(np.float32) / 255, (0, 0), 6)[..., None]
plate = np.clip(src * (1 - hm) + fill * hm, 0, 255)
# behind the title, use the poster itself softened into haze: the letters become a warm glow
# that they later emerge from, so there is no filled patch to give the trick away
th = cv2.dilate(((E['title'] > 0.03) * 255).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))
th = cv2.GaussianBlur(th.astype(np.float32) / 255, (0, 0), 12)[..., None]
haze = 0.5 * cv2.GaussianBlur(src.astype(np.float32), (0, 0), 22) * 0.9 + 0.5 * plate
plate = np.clip(plate * (1 - th) + haze * th, 0, 255).astype(np.uint8)
# the badge also sits on the plate's base image used for the static parts
srcfix = src.copy(); bm = cv2.GaussianBlur(badge.astype(np.float32) / 255, (0, 0), 3)[..., None]
srcfix = (src * (1 - bm) + plate * bm).astype(np.uint8)
cv2.imwrite('work/plate.png', plate)

# foreground colour without the orange fringe: undo the blend against the filled background
A = np.clip(sum(E.values()), 0, 1)[..., None]
P, Q = srcfix_pre = src.astype(np.float32), plate.astype(np.float32)
fg = np.where(A > 0.04, (P - (1 - A) * Q) / np.maximum(A, 0.04), P)
cv2.imwrite('work/fg.png', np.clip(fg, 0, 255).astype(np.uint8))
cv2.imwrite('work/poster_clean.png', srcfix)

# title letters: connected components of the title key, one per glyph, left to right per line
tm = (E['title'] > 0.4).astype(np.uint8)
tm = cv2.morphologyEx(tm, cv2.MORPH_CLOSE, np.ones((5, 3), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(tm, 8)
glyphs = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 400]
glyphs.sort(key=lambda i: (cen[i][1] > 640, cen[i][0]))       # line 1 then line 2, left to right
print('title glyphs:', len(glyphs), [(int(cen[i][0]), int(cen[i][1])) for i in glyphs])
glyph_id = np.zeros((H, W), np.int16)
for gi, i in enumerate(glyphs, 1):
    m = cv2.dilate((lab == i).astype(np.uint8), np.ones((7, 7), np.uint8))
    glyph_id[(m > 0) & (glyph_id == 0)] = gi

np.savez_compressed('work/layers.npz', **{k: v.astype(np.float16) for k, v in E.items()},
                    glyph_id=glyph_id, glyph_line=np.array([cen[i][1] > 640 for i in glyphs]))

# quick visual checks
def show(a, name):
    v = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    cv2.imwrite(f'work/check_{name}.png', cv2.resize(v, (W // 2, H // 2)))
show(sum(E.values()), 'alpha')
