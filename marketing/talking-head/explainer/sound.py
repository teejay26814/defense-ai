"""Sound for the explainer: cleaned voice, a quiet original music bed, and small UI sounds,
all synthesised here (no sample packs). Every cue time comes from the graphics layer
(work/<name>/ov/cues.json), so each sound lands on the frame its graphic appears.

    python3 explainer/sound.py explainer/ai-automation-01.json   -> work/<name>/mix.wav
"""
import os, sys, json, subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import imageio_ffmpeg

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
rng = np.random.default_rng(11)

def tt(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def filt(x, kind, f, order=2): return sosfilt(butter(order, f, btype=kind, fs=SR, output='sos'), x, axis=0)
def env_ad(n, a, d): t = np.arange(n) / SR; return np.minimum(1, t / a) * np.exp(-t / d)

def reverb(x, secs=1.6, wet=.25):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = filt(rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / secs)[:, None], 'low', 6000); ir /= np.sqrt((ir ** 2).sum(0))
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 1.4

def st(x, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1) * 1.414

# ---- UI sounds: short, soft, mostly above the voice's fundamental
def pop(f0=950, f1=520, d=.09):
    t = tt(d); f = f1 + (f0 - f1) * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 48)
def tick():
    t = tt(.05)
    return filt(rng.standard_normal(len(t)), 'band', [2500, 7000]) * np.exp(-t * 320) * .7 + .4 * np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 140)
def bell(m, d=1.2):
    t = tt(d); f = midi(m); x = np.zeros(len(t))
    for r, a, k in [(1, 1, 3.5), (2, .3, 5), (2.76, .18, 7), (5.4, .07, 10)]: x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * k)
    return x * np.minimum(1, t / .002)
def chime(notes, gap=.07, d=1.0):
    x = np.zeros(int((d + gap * len(notes)) * SR))
    for k, m in enumerate(notes): b = bell(m, d); i = int(k * gap * SR); x[i:i + len(b)] += b * (1 - .2 * k)
    return x
def whoosh(d=.45):
    n = int(d * SR); x = rng.standard_normal(n); y = np.zeros(n); blk = 1024
    for i in range(0, n - 64, blk // 2):
        p = i / n; fc = 400 * (5000 / 400) ** p; seg = x[i:i + blk]
        s = sosfilt(butter(2, [max(60, fc / 1.7), min(20000, fc * 1.7)], btype='band', fs=SR, output='sos'), seg)
        y[i:i + len(seg)] += s * np.hanning(len(seg))
    return y * np.sin(np.pi * np.arange(n) / n) ** 1.6
def impact(d=1.4, soft=False):
    t = tt(d); f = 38 + 60 * np.exp(-t * 9)
    boom = np.tanh(1.4 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2))
    air = filt(rng.standard_normal(len(t)), 'band', [300, 3000]) * np.exp(-t * 14) * (.15 if soft else .3)
    return boom * (.6 if soft else 1) + air

CUE = {
    'pop':        lambda: (pop(), .16),
    'tick':       lambda: (tick(), .10),
    'whoosh':     lambda: (whoosh(), .10),
    'confirm':    lambda: (chime([84, 91], .07), .07),
    'notify':     lambda: (chime([88, 95], .09, .9), .14),
    'impact':     lambda: (impact(), .22),
    'impact_soft':lambda: (impact(soft=True), .16),
    'msg_in':     lambda: (pop(640, 420, .1), .17),
    'msg_out':    lambda: (pop(1150, 760, .09), .15),
}

# ---- music: an original, quiet bed (F major, 100 bpm): soft pad, muted plucks, a felt pulse
def pluck(m, d=.5):
    f = midi(m); p = int(SR / f); n = int(d * SR)
    buf = filt(rng.uniform(-1, 1, p), 'low', 2400, 1); out = np.empty(n)
    for i in range(n): out[i] = buf[i % p]; buf[i % p] = .996 * .5 * (buf[i % p] + buf[(i + 1) % p])
    return out * np.exp(-np.arange(n) / SR * 4)
def pad(m, d):
    t = tt(d + .8); f = midi(m)
    x = sum(np.sin(2 * np.pi * f * (1 + dt) * t + rng.random() * 6) for dt in (-.003, 0, .003)) / 3
    x += .25 * sum(np.sin(4 * np.pi * f * (1 + dt) * t) for dt in (-.002, .002)) / 2
    e = np.minimum(1, t / .6) * np.where(t < d, 1, np.exp(-(t - d) / .25))
    return x * e
def music(dur):
    N = int(dur * SR) + SR; out = np.zeros((N, 2)); B = 60 / 100
    prog = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [46, 50, 53, 57]]   # Fmaj7 Am7 Dm7 Bbmaj7
    bar = 4 * B; nb = int(dur / bar) + 1
    for k in range(nb):
        ch = prog[(k // 2) % 4]; t0 = k * bar; i = int(t0 * SR)
        if k % 2 == 0:
            for m in ch:
                x = pad(m, 2 * bar); n = min(len(x), N - i); out[i:i + n] += st(x[:n], (m % 5 - 2) * .15) * .05
        arp = [ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12]
        for s in range(8):
            x = pluck(arp[s % 4], .45); j = int((t0 + s * B / 2) * SR); n = min(len(x), N - j)
            if n > 0: out[j:j + n] += st(x[:n], .3 if s % 2 else -.3) * (.05 if s % 4 == 0 else .032)
        for s in (0, 2):                                         # felt pulse, sub only
            t = tt(.4); x = np.sin(2 * np.pi * np.cumsum(46 + 40 * np.exp(-t * 25)) / SR) * np.exp(-t * 9)
            j = int((t0 + s * B) * SR); n = min(len(x), N - j)
            if n > 0: out[j:j + n] += st(x[:n]) * .12
    out = filt(out, 'low', 5000)                                 # keep it out of the voice's presence band
    out = reverb(out, 2.2, .3)
    return out[:int(dur * SR)]

def decode(path, af=None):
    cmd = [FF, '-v', 'quiet', '-i', path] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).copy()
def write(path, x):
    subprocess.run([FF, '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path], input=x.astype(np.float32).tobytes(), check=True)
def lufs(path):
    o = subprocess.run([FF, '-hide_banner', '-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return json.loads(o[o.rindex('{'):o.rindex('}') + 1])

def main():
    cfg = json.load(open(sys.argv[1])); work = os.path.join(HERE, 'work', cfg['name'])
    E = json.load(open(os.path.join(work, 'edl.json'))); dur = E['duration']; N = int(dur * SR)
    # voice: assemble the cuts with 8 ms edge fades, then clean it up
    a = decode(os.path.join(HERE, cfg['audio'])); parts = []
    for c in E['cuts']:
        p = a[int(c['in'] * SR):int(c['out'] * SR)].copy(); f = int(.008 * SR)
        p[:f] *= np.linspace(0, 1, f); p[-f:] *= np.linspace(1, 0, f); parts.append(p)
    raw = os.path.join(work, 'voice_raw.wav'); write(raw, np.repeat(np.concatenate(parts)[:, None], 2, 1))
    chain = ('highpass=f=75,afftdn=nf=-30:nr=8:tn=1,equalizer=f=180:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2,'
             'equalizer=f=9500:t=q:w=1:g=1.2,deesser=i=0.35,acompressor=threshold=-21dB:ratio=3:attack=6:release=110:makeup=2.5')
    v = decode(raw, chain)[:N]; v = np.pad(v, (0, N - len(v)))
    voice = st(v) / 1.414
    # ducking envelope from the voice (music sits lower while words are happening)
    e = np.convolve(np.abs(v), np.ones(int(.03 * SR)) / int(.03 * SR), 'same'); g = np.empty(N); cur = 0
    att, rel = np.exp(-1 / (.04 * SR)), np.exp(-1 / (.4 * SR))
    for i in range(0, N, 48):
        k = att if e[i] > cur else rel; cur = k * cur + (1 - k) * e[i]; g[i:i + 48] = cur
    duck = 1 - .5 * np.clip(g / (np.percentile(g, 90) * .5), 0, 1)
    bed = music(dur) * duck[:, None]
    # UI sounds on the graphics' cue times
    sfx = np.zeros((N, 2)); cues = json.load(open(os.path.join(work, 'ov', 'cues.json')))
    for t, kind in cues:
        x, gain = CUE[kind](); i = int(t * SR)
        if i >= N: continue
        x = st(x, .1); n = min(len(x), N - i); sfx[i:i + n] += x[:n] * gain
    sfx = reverb(sfx, .8, .12)
    # balance: voice leads; bed ~20 dB under it; UI sounds well under the words
    vr = np.sqrt(np.mean(voice ** 2)); br = np.sqrt(np.mean(bed ** 2)) + 1e-9
    bed *= vr * 10 ** (-20 / 20) / br
    sfx *= np.abs(voice).max() * .4 / (np.abs(sfx).max() + 1e-9)    # loudest cue at ~40% of the voice's peak
    mix = voice + bed + sfx
    fo = int(.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    pre = os.path.join(work, 'mix_pre.wav'); write(pre, mix)
    I = float(lufs(pre)['input_i']); gain = -14 - I
    out = os.path.join(work, 'mix.wav')
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', pre, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.85:attack=4:release=60:level=disabled', out], check=True)
    m = lufs(out); print(f"cues {len(cues)}; final {m['input_i']} LUFS, {m['input_tp']} dBTP -> {out}")

if __name__ == '__main__':
    main()
