"""Score, sound design and voice for the story cut — everything synthesised here, no sample packs.

    python3 mix_story.py                 -> story_final.mp4 (+ stems/)
    python3 mix_story.py --no-vo         -> music and SFX only

Music: an original 112.5 bpm cue written in code. The drop (logo) lands on T0 and
every downbeat after it is on the same grid the picture uses (story.py / story.html).
SFX cue times are computed from the same numbers story.html animates with.
Voice: vo/NN.wav from vo_tts.py, each phrase placed by its first spoken sample.
Master: -14 LUFS integrated, -1 dBTP.
"""
import os, sys, json, subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from story import B, T0, beat, DUR, VO

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
N = int(DUR * SR)
rng = np.random.default_rng(7)

def bus(): return np.zeros((N, 2), np.float32)
def tt(d): return np.arange(int(d * SR)) / SR
def midi(m): return 440 * 2 ** ((m - 69) / 12)
def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x, axis=0)
def add(b, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N: return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l * 1.414, x * r * 1.414], 1)
    if i < 0: x, i = x[-i:], 0
    n = min(len(x), N - i); b[i:i + n] += (x[:n] * gain).astype(np.float32)
def norm(x, peak_db):
    return x * (10 ** (peak_db / 20) / (np.abs(x).max() + 1e-9))

def reverb(x, secs=2.4, damp=5000, wet=.35, predelay=.02):
    n = int(secs * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / secs)[:, None]
    ir = filt(ir, 'low', damp); ir[:int(predelay * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
    y = np.stack([fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet * 1.6

def delay(x, d, fb=.35, mix=.3, n=5):
    y = x.copy(); k = int(d * SR)
    for j in range(1, n + 1):
        tap = np.zeros_like(x); tap[k * j:] = x[:len(x) - k * j] * fb ** j
        if j % 2: tap = tap[:, ::-1]                # ping-pong
        y += tap * mix
    return y

# ---------------------------------------------------------------- instruments
def saw(f, d, det=0.0):
    t = tt(d); ph = (f * (1 + det)) * t + rng.random()
    return 2 * (ph % 1) - 1

def pad_note(m, d, att=.4, rel=.8, bright=2400, voices=5):
    f = midi(m); n = int((d + rel) * SR)
    L = sum(saw(f, d + rel, det=(k - 2) * .0045) for k in range(voices) if k % 2 == 0)
    R = sum(saw(f, d + rel, det=(k - 2) * .0045) for k in range(voices) if k % 2 == 1) + saw(f, d + rel, .001)
    x = np.stack([L, R], 1)[:n] / voices
    t = np.arange(n) / SR
    env = np.minimum(1, t / att) * np.where(t < d, 1, np.exp(-(t - d) / (rel / 4)))
    return filt(x * env[:, None], 'low', bright, 2)

def pluck(m, d=.6, bright=.5):
    f = midi(m); p = int(SR / f); n = int(d * SR)
    buf = rng.uniform(-1, 1, p); buf = filt(buf, 'low', 1500 + 5000 * bright, 1)
    out = np.empty(n); s = .996
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = s * .5 * (buf[i % p] + buf[(i + 1) % p])
    return out * np.exp(-np.arange(n) / SR * 3)

def kick(lvl=1.0):
    t = tt(.5); f = 44 + 110 * np.exp(-t * 32)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    x[:int(.004 * SR)] += rng.uniform(-.6, .6, int(.004 * SR))
    return np.tanh(x * 1.6) * lvl

def clap():
    t = tt(.35); x = np.zeros(len(t))
    for k, o in enumerate([0, .011, .022]):
        i = int(o * SR); n = len(t) - i
        x[i:] += rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (60 if k < 2 else 14))
    return filt(filt(x, 'high', 900), 'low', 6000)

def hat(open_=False):
    t = tt(.3 if open_ else .06); x = np.diff(rng.standard_normal(len(t) + 1))
    return filt(x, 'high', 7000) * np.exp(-t * (14 if open_ else 70))

def sub(m, d):
    t = tt(d); f = midi(m)
    x = np.sin(2 * np.pi * f * t) + .25 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / .01) * np.exp(-t * 3.2)
    return np.tanh(1.8 * x * env)

def bell(m, d=2.2, hard=.0):
    t = tt(d); f = midi(m); x = np.zeros(len(t))
    for r, a, dec in [(1, 1, 2.2), (2.0, .35, 3), (2.76, .25, 4.5), (5.4, .12, 7), (8.93, .06 * (1 + 3 * hard), 11)]:
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dec)
    return x * np.minimum(1, t / .002)

def piano(m, d=4.0):
    t = tt(d); f = midi(m); x = np.zeros(len(t))
    for h, a in enumerate([1, .5, .28, .16, .09, .05], 1):
        x += a * np.sin(2 * np.pi * f * h * (1 + .0004 * h * h) * t) * np.exp(-t * (1.1 + h * .7))
    return x * np.minimum(1, t / .003)

def noise_sweep(d, f0, f1, shape='rise'):
    """Band-limited noise whose centre glides f0 -> f1 (done in short overlapping blocks)."""
    n = int(d * SR); x = rng.standard_normal(n); y = np.zeros(n); blk = 1024
    for i in range(0, n, blk // 2):
        p = i / n; fc = f0 * (f1 / f0) ** p
        seg = x[i:i + blk]
        if len(seg) < 32: break
        lo, hi = max(40, fc / 1.8), min(SR / 2 - 100, fc * 1.8)
        s = sosfilt(butter(2, [lo, hi], btype='band', fs=SR, output='sos'), seg)
        w = np.hanning(len(seg)); y[i:i + len(seg)] += s * w
    t = np.arange(n) / n
    env = {'rise': t ** 2.2, 'fall': (1 - t) ** 2, 'swell': np.sin(np.pi * t) ** 1.5}[shape]
    return y * env

def whoosh(d=.7, up=True):
    a = noise_sweep(d, 300 if up else 4000, 4500 if up else 350, 'swell')
    return np.stack([a, np.roll(a, int(.012 * SR))], 1)

def impact(size=1.0):
    t = tt(3.0); f = 26 + 48 * np.exp(-t * 3)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (1.3 / size))
    crack = filt(rng.standard_normal(len(t)), 'low', 2500) * np.exp(-t * 9)
    return np.tanh(1.5 * boom) + .35 * crack

def riser(d):
    n = int(d * SR); t = np.arange(n) / SR; p = t / d
    f = midi(50) * 2 ** (2 * p ** 1.5)
    tone = sum(np.sin(2 * np.pi * np.cumsum(f * (1 + k * .006)) / SR) for k in (-1, 0, 1)) / 3
    return noise_sweep(d, 250, 9000, 'rise') * .8 + tone * p ** 2.5 * .35

def tick():
    t = tt(.06)
    return (filt(rng.standard_normal(len(t)), 'band', [2500, 6000]) * np.exp(-t * 300) + .5 * np.sin(2 * np.pi * 1350 * t) * np.exp(-t * 120))

def key_click():
    t = tt(.05); fc = rng.uniform(2600, 4200)
    x = filt(rng.standard_normal(len(t)), 'band', [fc / 1.3, fc * 1.3]) * np.exp(-t * 260)
    return x + .6 * np.sin(2 * np.pi * rng.uniform(170, 230) * t) * np.exp(-t * 120)

def pop(f0=900, f1=480):
    t = tt(.09); f = f1 + (f0 - f1) * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)

def paper():
    t = tt(.16); x = filt(rng.standard_normal(len(t)), 'band', [700, 5000]) * np.exp(-t * 32)
    return x * np.minimum(1, t / .008) + .5 * np.sin(2 * np.pi * 110 * t) * np.exp(-t * 40)

def slam():
    t = tt(.9); f = 52 + 70 * np.exp(-t * 25)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    knock = filt(rng.standard_normal(len(t)), 'band', [180, 1400]) * np.exp(-t * 38)
    return np.tanh(1.6 * body) + .6 * knock

def chime(notes, gap=.07, d=1.6):
    x = np.zeros(int((d + gap * len(notes)) * SR))
    for k, m in enumerate(notes):
        b = bell(m, d); i = int(k * gap * SR); x[i:i + len(b)] += b * (1 - .15 * k)
    return x

# ---------------------------------------------------------------- MUSIC
mus, drm = bus(), bus()
D, Bm, G, A_ = [50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 55, 59, 62, 67], [45, 57, 61, 64, 69]
ROOT = {id(D): 38, id(Bm): 35, id(G): 31, id(A_): 33}

# intro 0 - 6.0: low drone in D minor, swelling, then sucked out before the black
for m, g in [(38, .9), (45, .5), (50, .35), (53, .28), (57, .22)]:
    x = pad_note(m, 5.3, att=2.2, rel=.5, bright=900 + 60 * (m - 38))
    add(mus, x, 0.15, g)
t = tt(5.9); drone = np.sin(2 * np.pi * midi(26) * t) * np.minimum(1, t / 2) * .6
add(mus, drone, .1)
sh = pad_note(81, 2.6, att=1.6, rel=.4, bright=6000, voices=3) + pad_note(74, 2.6, att=1.6, rel=.4, bright=6000, voices=3)
add(mus, sh, 3.2, .12)
env_cut = np.ones(N); i0, i1 = int(5.55 * SR), int(5.98 * SR)
env_cut[i0:i1] = np.linspace(1, 0, i1 - i0) ** 2; env_cut[i1:int(6.3 * SR)] = 0
mus *= env_cut[:, None]

# problem 6.37 - 10.7: muted plucks (Dm add9), soft pulse; filter opens towards the converge
for n in range(-10, -1):
    tb = beat(n)
    if tb > 10.7: break
    add(drm, kick(.45), tb)
    for k, m in enumerate([62, 65, 69, 72][::(1 if n % 2 else -1)]):
        add(mus, pluck(m, .5, bright=.2 + .06 * (n + 10)), tb + k * B / 4, .22, pan=(-.4 if k % 2 else .4))
for m in [50, 57, 62, 65]:
    add(mus, pad_note(m, 4.2, att=1.4, rel=.6, bright=1100), 6.3, .16)

# drop: bars of four beats from T0, D - Bm - G - A
prog = [D, Bm, G, A_, D, Bm, G, A_, D, Bm]
for bar, ch in enumerate(prog):
    tb = beat(bar * 4)
    for m in ch[1:]:
        add(mus, pad_note(m, 4 * B, att=.12 if bar == 0 else .25, rel=.6, bright=2600), tb, .11)
    r = ROOT[id(ch)]
    for e in range(8):                                     # 8th-note sub, sidechained below
        add(mus, sub(r + 12, B / 2 * .9), tb + e * B / 2, .42 if e % 2 else .55)
    arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 12, ch[4] + 12, ch[1] + 24]
    for s in range(16):                                    # 16th-note pluck arpeggio
        add(mus, pluck(arp[s % 8], .45, bright=.55), tb + s * B / 4, .15 if s % 4 else .2, pan=.35 * np.sin(s * .8))
    for bt in range(4):
        tbt = tb + bt * B
        add(drm, kick(1.0), tbt)
        if bt % 2: add(drm, clap(), tbt, .5, pan=.05)
        for h in range(2):
            add(drm, hat(open_=(h == 1 and bt == 3)), tbt + h * B / 2, .16 + .05 * h, pan=.3)
# a lift into the examiner section: snare roll over the last beat of bar 7
for k in range(8):
    add(drm, clap(), beat(31) + k * B / 8, .12 + .05 * k)

# montage (beat 40 - 48): drums out, sustained G -> A with a riser; a hit on every word
for m in G[1:]: add(mus, pad_note(m, 4 * B, att=.05, rel=.3, bright=3200), beat(40), .13)
for m in A_[1:]: add(mus, pad_note(m + 12 if m < 60 else m, 4 * B, att=.05, rel=.2, bright=3800), beat(44), .12)
add(mus, sub(31 + 12, 2.0), beat(40), .6); add(mus, sub(33 + 12, 2.0), beat(44), .6)
for k, n in enumerate([40, 42, 44, 46]):
    add(drm, kick(1.1), beat(n)); add(drm, impact(.4)[:int(1.2 * SR)], beat(n), .35 + .1 * k)
    add(drm, clap(), beat(n), .35)
add(mus, riser(4 * B), beat(44), .5)

# resolution at beat 48: silence, then a deep soft hit and an open D chord that breathes to the end
BR = beat(48)
for m in [38, 50, 57, 62, 66, 69, 74]:
    add(mus, pad_note(m, 5.2, att=.9, rel=1.6, bright=1800 + 30 * (m - 38)), BR + .05, .10 if m > 40 else .3)
for k, m in enumerate([62, 69, 74, 78]):
    add(mus, piano(m, 5), BR + .1 + k * .32, .22 - .03 * k, pan=-.3 + .2 * k)
add(mus, piano(74, 4), 40.6, .12); add(mus, piano(81, 4), 40.62, .07)

# sidechain: music breathes against the kick after the drop
side = np.ones(N)
for n in range(0, 40):
    i = int(beat(n) * SR); L = int(.28 * SR)
    side[i:i + L] = np.minimum(side[i:i + L], 1 - .55 * np.exp(-np.arange(L) / SR * 14))
mus *= side[:, None]
mus = reverb(mus, 2.6, 6000, .28)
mus[:, :] = delay(mus, 3 * B / 4, .3, .12, 3)
drm = reverb(drm, 1.2, 7000, .12)

# ---------------------------------------------------------------- SFX
fx = bus()
for k, tk in enumerate(np.arange(.4, 3.05, .5)):                         # clock under the opening line
    add(fx, tick(), tk, .5 if k % 2 == 0 else .35, pan=.1)
add(fx, impact(.6), 3.25, .38)                                            # "Would you be ready?"
add(fx, whoosh(.5, up=False), 5.5, .3)
for i in range(8): add(fx, paper(), 6.35 + i * .17 + .1, .45, pan=[-.6, 0, .6, -.7, .7, -.3, .3, 0][i])
add(fx, whoosh(.6), 8.6, .18)
add(fx, whoosh(.9), 10.72, .45); add(fx, riser(1.0), 10.66, .55)
add(fx, impact(1.0), 11.66, 1.0); add(fx, chime([86, 93, 98], .05, 2.5), 11.7, .22)
for tr in [14.63, 18.90, 24.23, 28.50]: add(fx, whoosh(.55), tr - .3, .32)
ROW_T = [15.25 + i * .36 + .62 for i in range(5)]
for k, t0 in enumerate(ROW_T): add(fx, pop(1000 + 140 * k, 620 + 90 * k), t0, .3, pan=.4)
add(fx, chime([81, 88], .06, 1.2), ROW_T[-1] + .25, .18)
TYPE_T0, TYPE_T1, TEXT = 19.55, 21.0, 'What are the limitations of my study?'
for i, c in enumerate(TEXT):
    tc = TYPE_T0 + i * (TYPE_T1 - TYPE_T0) / len(TEXT)
    add(fx, key_click(), tc + rng.uniform(-.005, .005), (.32 if c != ' ' else .45) * rng.uniform(.7, 1), pan=.35)
add(fx, pop(700, 380), 21.15, .45, pan=.35); add(fx, whoosh(.35), 21.15, .12)
add(fx, chime([79, 86], .06, 1.0), 22.1, .14)
add(fx, pop(1300, 900), 23.25, .2, pan=.4); add(fx, pop(1400, 1000), 23.45, .18, pan=.45)
add(fx, paper(), 24.5, .35, pan=-.4); add(fx, paper(), 24.75, .35, pan=.4)
add(fx, whoosh(.3, up=False), 25.55, .3, pan=-.4)
add(fx, pop(900, 600), 26.35, .3, pan=.4); add(fx, chime([84, 91], .07, 1.2), 26.45, .2)
add(fx, pop(1200, 800), 26.9, .18, pan=-.4)
QT = [beat(32), beat(33.5), beat(34.5), beat(35.5)]
for k, q in enumerate(QT): add(fx, slam(), q + .02, .42 + .06 * k)
RD = beat(37)
add(fx, whoosh(.5), RD - .2, .3)
last = -1
for i in range(int(1.6 * SR / 480)):                                      # readiness counter ticks per 2%
    tt_ = RD + .25 + i * 480 / SR
    r = 1 - (1 - min(1, (tt_ - RD - .25) / 1.5)) ** 3; v = int(86 * r) // 2
    if v != last: add(fx, tick(), tt_, .15 + .1 * r, pan=.1); last = v
add(fx, chime([86, 90, 93], .06, 1.6), RD + 1.8, .22)
add(fx, impact(2.2), BR, .7); add(fx, chime([74, 81, 86, 93], .09, 3.5), BR + .05, .16)
add(fx, whoosh(.7), 39.1, .15); add(fx, pop(800, 520), 40.62, .25)

# ---------------------------------------------------------------- VOICE
def decode(path, sr, af=None, ch=1):
    cmd = [FF, '-v', 'quiet', '-i', path] + (['-af', af] if af else []) + ['-ac', str(ch), '-ar', str(sr), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).copy()

vo = np.zeros(N, np.float32)
use_vo = '--no-vo' not in sys.argv
if use_vo:
    chain = ('highpass=f=80,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=3400:t=q:w=1.2:g=2.5,equalizer=f=9000:t=q:w=1:g=1.5,'
             'acompressor=threshold=-20dB:ratio=3:attack=6:release=120:makeup=2')
    ends = []
    for k, (t0, text, *_) in enumerate(VO):
        a = decode(os.path.join(HERE, 'vo', f'{k:02d}.wav'), SR, chain)
        on = np.abs(a) > .02 * np.abs(a).max(); i = max(0, np.argmax(on) - int(.04 * SR)); j = len(a) - np.argmax(on[::-1]) + int(.18 * SR)
        a = a[i:j]; a[-int(.06 * SR):] *= np.linspace(1, 0, int(.06 * SR))
        s = int(t0 * SR); n = min(len(a), N - s); vo[s:s + n] += a[:n]
        ends.append((t0, t0 + len(a) / SR, text))
    for k in range(1, len(ends)):
        if ends[k][0] < ends[k - 1][1] - .15: print(f'  OVERLAP {ends[k - 1][2]!r} -> {ends[k][2]!r}')
    vo = vo / np.abs(vo).max() * .8
    vo2 = reverb(np.stack([vo, vo], 1), .9, 5000, .07, .01)
else:
    vo2 = bus()

# duck the music (not the sound design) under the voice
env = np.abs(vo); w = int(.02 * SR)
env = np.convolve(env, np.ones(w) / w, 'same')
att, rel = np.exp(-1 / (.03 * SR)), np.exp(-1 / (.35 * SR))
g = np.empty(N); cur = 0.0
for i in range(0, N, 48):                                                 # 1 ms control rate
    e = env[i]; cur = (att if e > cur else rel) * cur + (1 - (att if e > cur else rel)) * e; g[i:i + 48] = cur
duck = 1 - .68 * np.clip(g / .05, 0, 1)                                   # up to -10 dB

stems = dict(music=norm(mus, -6), drums=norm(drm, -5), sfx=norm(fx, -4), vo=vo2)
mix = stems['music'] * .62 * duck[:, None] + stems['drums'] * .5 * duck[:, None] ** .8 + stems['sfx'] * .6 * duck[:, None] ** .35 + vo2 * (1.0 if use_vo else 0)
mix[-int(.9 * SR):] *= np.linspace(1, 0, int(.9 * SR))[:, None] ** 2

os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
def write(path, x):
    subprocess.run([FF, '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path], input=x.astype(np.float32).tobytes(), check=True)
for k, x in stems.items(): write(os.path.join(HERE, 'stems', f'{k}.wav'), x)
raw = os.path.join(HERE, 'stems', 'mix_raw.wav'); write(raw, mix)
meas = subprocess.run([FF, '-hide_banner', '-i', raw, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
I = float(json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])['input_i'])
gain = -14 - I + 0.4                                                      # +1 dB lets the limiter catch the hits
print(f'mix {I:.1f} LUFS -> gain {gain:+.1f} dB')
final = os.path.join(HERE, 'stems', 'mix.wav')
subprocess.run([FF, '-y', '-v', 'quiet', '-i', raw, '-af', f'volume={gain}dB,alimiter=limit=0.82:attack=3:release=60:level=disabled', '-ar', str(SR), final], check=True)
meas = subprocess.run([FF, '-hide_banner', '-i', final, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1]); print(f"final {m['input_i']} LUFS, {m['input_tp']} dBTP")

video = os.path.join(HERE, 'story-silent.mp4')
out = os.path.join(HERE, 'story_final.mp4' if use_vo else 'story_novo.mp4')
if os.path.exists(video):
    subprocess.run([FF, '-y', '-v', 'quiet', '-i', video, '-i', final, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], check=True)
    print('->', out)
