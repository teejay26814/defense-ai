"""Grade for iPhone HLG footage, built in scene-linear light and baked to a 3D LUT that maps
HLG/BT.2020 RGB -> HLG/BT.2020 RGB, so the edit stays HDR end to end.

    python3 explainer/hlg_lut.py looks/explainer-hlg.cube

Correction first, then a light look:
  1. white balance: the wall reads b/g 0.94 in linear light (slightly warm) -> nudge blue up
  2. highlights: forehead and wall sit at ~0.89 HLG signal, near clipping -> soft knee on
     luminance (hue-preserving), so skin shine and the wall come back without going grey
  3. look: a touch of cool navy in the deep shadows only, saturation 0.97, gentle midtone
     contrast. Blacks are not crushed; skin midtones are left where they are.
"""
import sys
import numpy as np

a, b, c = 0.17883277, 0.28466892, 0.55991073
def inv(E): return np.where(E <= .5, E * E / 3, (np.exp((E - c) / a) + b) / 12)
def oetf(L):
    L = np.clip(L, 0, 1)
    return np.where(L <= 1 / 12, np.sqrt(3 * L), a * np.log(np.maximum(12 * L - b, 1e-9)) + c)

WB = [0.995, 1.0, 1.025]
def grade(rgb):
    L = inv(rgb)
    L = L * np.array(WB)                                                    # 1. white balance (per take: python3 hlg_lut.py out.cube R B)
    Y = L @ np.array([0.2627, 0.6780, 0.0593])
    k, top = 0.15, 0.50                                                     # 2. highlight knee
    Yk = np.where(Y < k, Y, k + (top - k) * np.tanh((Y - k) / (top - k)))
    L = L * (Yk / np.maximum(Y, 1e-9))[..., None]
    Y = Yk
    t = np.clip(1 - Y / 0.03, 0, 1) ** 1.5                                  # 3. cool deep shadows
    L = L * np.stack([1 - .05 * t, np.ones_like(t), 1 + .10 * t], -1)
    L = Y[..., None] + (L - Y[..., None]) * 0.97                            #    saturation
    s = oetf(L)
    s = s + 0.06 * (s - 0.45) * np.exp(-((s - 0.45) / 0.25) ** 2)           #    midtone contrast
    return np.clip(s, 0, 1)

if __name__ == '__main__':
    if len(sys.argv) > 3: WB = [float(sys.argv[2]), 1.0, float(sys.argv[3])]
    N = 33
    g = np.linspace(0, 1, N)
    B_, G_, R_ = np.meshgrid(g, g, g, indexing='ij')                        # .cube: red varies fastest
    out = grade(np.stack([R_, G_, B_], -1).reshape(-1, 3))
    with open(sys.argv[1], 'w') as f:
        f.write(f'TITLE "explainer HLG grade"\nLUT_3D_SIZE {N}\n')
        for r in out: f.write(f'{r[0]:.6f} {r[1]:.6f} {r[2]:.6f}\n')
    print('->', sys.argv[1])
