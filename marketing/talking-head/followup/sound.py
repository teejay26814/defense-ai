"""Voice + SFX (+ music) for the follow-up reel. Two masters, both -14 LUFS:
    work/followup/mix_music.wav     voice, sound effects, quiet original lo-fi bed (~-25 dB under the voice, ducked)
    work/followup/mix_nomusic.wav   voice and sound effects only (add a trending sound in Instagram)

    python3 followup/sound.py
"""
import os, sys, json, subprocess
import numpy as np
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, 'explainer'))
import sound as S                                   # synth helpers shared with the explainer reel

SR = S.SR
WORK = os.path.join(HERE, 'work/followup')

def lofi(dur):
    """calm bed: the explainer's pad + plucks, warmer (lower cut-off) with soft tape hiss and a lazy hat"""
    x = S.music(dur + 1)[:int(dur * SR)]
    x = S.filt(x, 'low', 3200)
    hiss = S.filt(S.rng.standard_normal((len(x), 2)), 'band', [2000, 9000]) * .004
    t = np.arange(len(x)) / SR; B = 60 / 100
    hat = np.zeros(len(x))
    for k in range(int(dur / (B / 2))):
        i = int((k * B / 2 + (.03 if k % 2 else 0)) * SR); h = S.filt(S.rng.standard_normal(int(.05 * SR)), 'high', 7000) * np.exp(-np.arange(int(.05 * SR)) / SR * 70)
        n = min(len(h), len(x) - i)
        if n > 0: hat[i:i + n] += h[:n] * (.025 if k % 2 else .015)
    return x + hiss + np.stack([hat, hat], 1)

def main():
    C = json.load(open(os.path.join(HERE, 'followup/followup.json')))
    E = json.load(open(os.path.join(WORK, 'edl.json'))); dur = E['duration']; N = int(round(dur * SR))
    src = {k: S.decode(os.path.join(HERE, v['audio'])) for k, v in C['sources'].items()}
    parts = []
    for c in E['cuts']:
        p = src[c['src']][int(round(c['in'] * SR)):int(round(c['out'] * SR))].copy(); f = int(.008 * SR)
        p[:f] *= np.linspace(0, 1, f); p[-f:] *= np.linspace(1, 0, f); parts.append(p)
    raw = os.path.join(WORK, 'voice_raw.wav'); S.write(raw, np.repeat(np.concatenate(parts)[:, None], 2, 1))
    chain = ('highpass=f=80,afftdn=nf=-30:nr=8:tn=1,equalizer=f=200:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2.2,'
             'equalizer=f=9500:t=q:w=1:g=1,deesser=i=0.35,acompressor=threshold=-21dB:ratio=3:attack=6:release=110:makeup=2.5')
    v = S.decode(raw, chain)[:N]; v = np.pad(v, (0, N - len(v))); voice = S.st(v) / 1.414
    vr = np.sqrt(np.mean(voice[np.abs(voice).max(1) > .01] ** 2))
    # sound effects on the graphics' cue times, quiet: loudest about a quarter of the voice's peak
    sfx = np.zeros((N, 2)); cues = json.load(open(os.path.join(WORK, 'ov', 'cues.json')))
    gain = {'pop': .10, 'tick': .07, 'whoosh': .09}
    for t, kind in cues:
        x, _ = S.CUE[kind](); i = int(t * SR)
        if 0 <= i < N: x = S.st(x, .1); n = min(len(x), N - i); sfx[i:i + n] += x[:n] * gain[kind]
    sfx = S.reverb(sfx, .7, .1)
    sfx *= np.abs(voice).max() * .28 / (np.abs(sfx).max() + 1e-9)
    # ducking from the voice envelope
    e = np.convolve(np.abs(v), np.ones(int(.03 * SR)) / int(.03 * SR), 'same'); g = np.empty(N); cur = 0
    att, rel = np.exp(-1 / (.04 * SR)), np.exp(-1 / (.45 * SR))
    for i in range(0, N, 48):
        k = att if e[i] > cur else rel; cur = k * cur + (1 - k) * e[i]; g[i:i + 48] = cur
    duck = 1 - .45 * np.clip(g / (np.percentile(g, 90) * .5), 0, 1)
    bed = lofi(dur)[:N]; bed = np.pad(bed, ((0, N - len(bed)), (0, 0)))
    bed *= vr * 10 ** (-25 / 20) / (np.sqrt(np.mean(bed ** 2)) + 1e-9)          # ~-25 dB under the voice, before ducking
    bed *= duck[:, None]
    fo = int(2.5 * SR); bed[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5       # fade out under the end card
    tail = int(.25 * SR)
    for name, mix in [('mix_music', voice + sfx + bed), ('mix_nomusic', voice + sfx)]:
        mix = mix.copy(); mix[-tail:] *= np.linspace(1, 0, tail)[:, None]
        pre = os.path.join(WORK, name + '_pre.wav'); S.write(pre, mix)
        I = float(S.lufs(pre)['input_i']); out = os.path.join(WORK, name + '.wav')
        subprocess.run([S.FF, '-y', '-v', 'quiet', '-i', pre, '-af', f'volume={-14 - I:.2f}dB,alimiter=limit=0.85:attack=4:release=60:level=disabled', out], check=True)
        m = S.lufs(out); print(f"{name}: {m['input_i']} LUFS, {m['input_tp']} dBTP")

if __name__ == '__main__':
    main()
