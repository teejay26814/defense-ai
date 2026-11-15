"""Build a 3D LUT (.cube) for natural, selective correction, the way a colourist would with
qualifiers - instead of a blanket filter. Works in OKLab (perceptual): L = lightness, a/b = colour.

    python3 grade_lut.py looks/nurse-studio.cube [--measure img.png x,y ...]
"""
import sys, numpy as np

def srgb_to_lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lin_to_srgb(c): c = np.clip(c, 0, 1); return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
def to_oklab(rgb):
    lms = srgb_to_lin(rgb) @ M1.T; return np.cbrt(lms) @ M2.T
def from_oklab(lab):
    lms = (lab @ np.linalg.inv(M2).T) ** 3; return lin_to_srgb(lms @ np.linalg.inv(M1).T)

def smooth(x, a, b):          # 0 below a, 1 above b, smooth between
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def band(h, c, w):            # soft hue window (degrees), centre c, half-width w
    d = np.abs((h - c + 180) % 360 - 180); return 1 - smooth(d, w * 0.5, w)

def grade(rgb):
    lab = to_oklab(rgb); L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b); h = np.degrees(np.arctan2(b, a)) % 360
    # 1) neutralise the cool/magenta cast that lives in the shadows (black panels read navy) -
    #    strongest in the darks, fading out by the mids so whites stay exactly as they are
    sh = 1 - smooth(L, 0.25, 0.62)
    a = a - 0.010 * sh; b = b + 0.022 * sh
    # 2) skin: purple/magenta-leaning skin (red-shirt bounce + LED) rotated back toward a healthy
    #    warm hue, only for moderate chroma so the saturated shirt is untouched
    skin_q = band(h, 0, 95) * (1 - smooth(C, 0.05, 0.07)) * smooth(C, 0.010, 0.025) * smooth(L, 0.10, 0.22)
    target = 50.0                                            # warm, healthy (not orange)
    dh = ((target - h + 180) % 360 - 180) * 0.82 * skin_q
    C = np.hypot(a, b); h2 = np.radians(h + dh)
    C = C * (1 + 0.10 * skin_q)                              # a touch of life in the skin
    a, b = C * np.cos(h2), C * np.sin(h2)
    # 3) the red shirt: very high chroma reds pulled back so it stops dominating and bleeding
    shirt_q = band(np.degrees(np.arctan2(b, a)) % 360, 10, 40) * smooth(C, 0.12, 0.18)
    C2 = np.hypot(a, b) * (1 - 0.08 * shirt_q); hh = np.arctan2(b, a)
    a, b = C2 * np.cos(hh), C2 * np.sin(hh)
    L = L - 0.06 * shirt_q                                   # deeper, not paler: paler red reads pink
    # 4) background blues desaturated (navy panels -> charcoal) for quiet separation behind the subject
    blue_q = band(np.degrees(np.arctan2(b, a)) % 360, 255, 50)
    k = 1 - 0.45 * blue_q; a, b = a * k, b * k
    # 5) tone: lift the face's mid-tones gently, keep blacks off the floor, soft highlight roll-off
    x = L
    lift_mask = 1 - shirt_q
    L = x + 0.045 * lift_mask * np.sin(np.pi * np.clip(x, 0, 1)) * (1 - smooth(x, 0.75, 0.95))   # mid lift (not on the shirt)
    L = np.where(L > 0.88, 0.88 + (L - 0.88) * 0.72, L)                               # highlight shoulder
    L = 0.012 + L * (1 - 0.012)                                                        # blacks never crushed
    out = from_oklab(np.stack([L, a, b], -1))
    return np.clip(out, 0, 1)

def write_cube(path, n=33):
    g = np.linspace(0, 1, n)
    bb, gg, rr = np.meshgrid(g, g, g, indexing='ij')                 # .cube: R varies fastest
    rgb = np.stack([rr, gg, bb], -1).reshape(-1, 3)
    out = grade(rgb)
    with open(path, 'w') as f:
        f.write(f'TITLE "nurse-studio natural"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for r_, g_, b_ in out: f.write(f'{r_:.6f} {g_:.6f} {b_:.6f}\n')

if __name__ == '__main__':
    write_cube(sys.argv[1]); print('wrote', sys.argv[1])
