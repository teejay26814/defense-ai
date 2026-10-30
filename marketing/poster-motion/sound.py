"""Song + sound effects for the poster animation.

    python3 sound.py <song.mp3>   -> out/prophetic-worship-song.mp4 (song + sfx), out/prophetic-worship-sfx.mp4 (sfx only)

Picks the 12 s of the song where the energy lifts hardest about a second in, so the title rises
on that lift. Effects are synthesized (no samples) and sit well under the song.
"""
import sys, os, subprocess
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'talking-head', 'explainer'))
import sound as S

SR, DUR = S.SR, 12.0
N = int(DUR * SR)
VIDEO = 'out/prophetic-worship.mp4'

def stereo(path):
    raw = subprocess.run([S.FF, '-v', 'quiet', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()

def pick(song):
    """start time whose first second is calm and whose next few seconds lift (title lands on the lift)"""
    hop = SR // 10
    e = np.sqrt(np.convolve((song ** 2).mean(1), np.ones(hop) / hop, 'same')[::hop] + 1e-9)
    e = 20 * np.log10(e)
    best, bs = 0, -1e9
    for i in range(150, len(e) - 140):                              # skip the first 15 s (intro)
        lift = e[i + 10:i + 40].mean() - e[i - 5:i + 8].mean()
        body = e[i:i + 120].mean()
        sc = lift + 0.35 * (body - e.max())
        if sc > bs: bs, best = sc, i
    return best / 10

def sfx():
    out = np.zeros((N, 2))
    def put(t, x, g, pan=0.0):
        x = S.st(x, pan) if x.ndim == 1 else x
        i = int(t * SR); n = min(len(x), N - i)
        if n > 0: out[i:i + n] += x[:n] * g
    put(0.30, S.chime([86, 93, 98], .08, 1.6), .10)                # logo: soft shimmer
    put(0.85, S.whoosh(1.4), .10)                                  # light gathers where the title forms
    put(1.45, S.whoosh(1.1), .07, .2)
    put(2.35, S.impact(1.8, soft=True), .13)                       # WORSHIP completes
    put(3.15, S.chime([93, 98, 105], .06, 1.4), .06, .3)           # gold sweep glimmer
    order = [4, 3, 5, 2, 6, 1, 7, 0]
    for n, ci in enumerate(order):                                 # each minister lands
        put(4.0 + n * 0.17 + 0.32, S.pop(760 - n * 18, 430, .11), .11, (ci - 3.5) / 5)
    put(6.0, S.whoosh(1.2), .06)                                   # date and venue rise
    put(6.7, S.chime([91, 98], .09, 1.2), .05, .4)                 # light runs along the details
    put(8.7, S.chime([93, 98, 105], .06, 1.4), .05, -.2)           # second sweep
    return S.reverb(out, 1.8, .3)

def main():
    song_path = sys.argv[1]
    song = stereo(song_path)
    t0 = pick(song)
    print(f'song section: {t0:.1f}s - {t0 + DUR:.1f}s')
    seg = song[int(t0 * SR):int(t0 * SR) + N].astype(np.float64)
    seg = np.pad(seg, ((0, N - len(seg)), (0, 0)))
    fi, fo = int(0.5 * SR), int(2.0 * SR)
    seg[:fi] *= np.linspace(0, 1, fi)[:, None]; seg[-fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]
    fx = sfx()
    seg *= 0.5 / (np.abs(seg).max() + 1e-9); fx *= np.abs(seg).max() * 0.55 / (np.abs(fx).max() + 1e-9)
    os.makedirs('work', exist_ok=True)
    for name, mix in [('song', seg + fx), ('sfx', fx * 1.6)]:
        pre = f'work/mix_{name}_pre.wav'; S.write(pre, mix)
        I = float(S.lufs(pre)['input_i']); wav = f'work/mix_{name}.wav'
        subprocess.run([S.FF, '-y', '-v', 'quiet', '-i', pre, '-af', f'volume={-14 - I:.2f}dB,alimiter=limit=0.89:level=disabled', wav], check=True)
        out = f'out/prophetic-worship-{name}.mp4'
        subprocess.run([S.FF, '-y', '-v', 'error', '-i', VIDEO, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
        print('->', out, S.lufs(wav)['input_i'], 'LUFS')

if __name__ == '__main__':
    main()
