"""Trailer-scale score, sound effects, voice placement and mix for the grand cut.

usage: python3 sound2.py <lines dir> <out dir>
Timeline (film seconds) is shared with film2.html: see CUES below.
"""
import sys, os, wave, json, subprocess
import numpy as np
from scipy import signal

SR = 48000
DUR = 42.0
N = int(SR * DUR)
rng = np.random.default_rng(11)

# where each voice line starts
CUES = {"l01": 1.4, "l02": 4.8, "l03": 9.2, "l04": 12.65, "l05": 14.6, "l06": 17.4,
        "l07": 21.8, "l08": 25.6, "l09": 30.8, "l10": 33.8, "l11": 36.45}
HIT1, HIT2, BREAK, FINAL = 0.35, 12.4, 30.2, 36.0


def t_axis(d): return np.arange(int(SR * d)) / SR
def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i < 0: return
    n = min(len(x), len(buf) - i); buf[i:i + n] += x[:n] * gain
def lp(x, hz, o=2): b, a = signal.butter(o, hz / (SR / 2), "low"); return signal.lfilter(b, a, x)
def hp(x, hz, o=2): b, a = signal.butter(o, hz / (SR / 2), "high"); return signal.lfilter(b, a, x)
def bp(x, lo, hi, o=2): b, a = signal.butter(o, [lo / (SR / 2), hi / (SR / 2)], "band"); return signal.lfilter(b, a, x)
def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def env(n, a, r):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.2
    return e


def saw(f, d, phase_rand=True):
    t = t_axis(d); out = np.zeros_like(t)
    for k in range(1, 14):
        out += np.sin(2 * np.pi * f * k * t + (rng.uniform(0, 6.28) if phase_rand else 0)) / k
    return out


def braam(root=38, d=4.5, gain=1.0):
    """Low brass-like blast: detuned saws on root/fifth/octave through an opening filter, saturated."""
    n = int(SR * d); x = np.zeros(n)
    for semis, g in ((0, 1.0), (7, .7), (12, .8), (-12, .9)):
        for dt in (-.006, 0, .006):
            x += saw(midi(root + semis) * (1 + dt), d) * g
    # time-varying lowpass: open fast, close slowly (block-wise)
    out = np.zeros(n); seg = 1024
    for i in range(0, n, seg):
        tt = i / SR
        cut = 180 + 2600 * np.exp(-((tt - .25) ** 2) / .08) + 500 * np.exp(-tt * 1.2)
        out[i:i + seg] = lp(x[i:i + seg], min(cut, 9000), 2)
    out = np.tanh(out / 3.5 * 2.2)
    out *= env(n, .05, d * .7) * np.exp(-t_axis(d) * .35)
    sub = np.sin(2 * np.pi * midi(root - 12) * t_axis(d)) * np.exp(-t_axis(d) * .7) * .8
    return (out + sub) * gain


def strings(notes, d, a=1.5, r=1.8, cutoff=1400, gain=1.0):
    x = np.zeros(int(SR * d))
    for nn in notes:
        for dt in (-.003, 0, .003):
            x += saw(midi(nn) * (1 + dt), d)
    vib = 1 + .02 * np.sin(2 * np.pi * 5.2 * t_axis(d))
    return lp(x * vib, cutoff) * env(len(x), a, r) / (len(notes) * 3) * gain


def ostinato(n, d=.22, gain=1.0):
    t = t_axis(d); f = midi(n)
    x = sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, 8))
    return lp(x, 2600) * np.exp(-t * 14) * np.minimum(1, t / .004) * gain


def heartbeat():
    def thump(f0, dur, g):
        t = t_axis(dur); f = f0 + 40 * np.exp(-t * 25)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * g
    out = np.zeros(int(.6 * SR)); place(out, thump(48, .35, 1.0), 0); place(out, thump(44, .35, .7), .2)
    return out


def tom(f0=70, d=.7, gain=1.0):
    t = t_axis(d); f = f0 * (1 + 1.2 * np.exp(-t * 18))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5.5)
    skin = lp(rng.normal(0, 1, len(t)), 1800) * np.exp(-t * 30) * .5
    return (body + skin) * gain


def snare_hit(gain=1.0):
    t = t_axis(.35)
    return (bp(rng.normal(0, 1, len(t)), 700, 6000) * np.exp(-t * 13) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 20) * .5) * gain


def riser(d, gain=1.0):
    n = int(SR * d); t = np.arange(n) / SR; noise = rng.normal(0, 1, n); out = np.zeros(n)
    for i in range(0, n, 480):
        c = 250 + 7000 * (i / n) ** 2.2; out[i:i + 480] = bp(noise[i:i + 480], c * .7, min(c * 1.4, 22000))
    tone = np.sin(2 * np.pi * np.cumsum(120 + 1100 * (t / d) ** 2.5) / SR) * .3
    return (out * .6 + tone) * (t / d) ** 2.4 * gain


def whoosh(d=.7, lo=250, hi=3500, gain=.5):
    n = int(SR * d); noise = rng.normal(0, 1, n); out = np.zeros(n)
    for i in range(0, n, 512):
        c = lo + (hi - lo) * np.sin(np.pi * i / n); out[i:i + 512] = bp(noise[i:i + 512], c * .6, min(c * 1.6, 20000))
    return lp(out, 9000) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * gain


def hit(gain=1.0):
    """Sharp cinematic impact for text slams: sub drop + crack + tail."""
    t = t_axis(1.8)
    boom = np.sin(2 * np.pi * np.cumsum(34 + 70 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.6)
    crack = hp(rng.normal(0, 1, len(t)), 1500) * np.exp(-t * 30) * .6
    return (boom + crack) * gain


def tick(f=2600, gain=.35):
    t = t_axis(.05)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 160) + hp(rng.normal(0, 1, len(t)), 4000) * np.exp(-t * 300) * .4) * gain


def bell(n, d=3.0, gain=.3):
    t = t_axis(d); f = midi(n)
    x = np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + .2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5)
    return x * np.exp(-t * 1.3) * np.minimum(1, t / .003) * gain


def pop(f=1100, gain=.3):
    t = t_axis(.09); return np.sin(2 * np.pi * f * t * (1 + .6 * np.exp(-t * 60))) * np.exp(-t * 55) * gain


def glide(f0, f1, d, gain=.12):
    t = t_axis(d); f = f0 * (f1 / f0) ** (t / d)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + .3 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * env(len(t), .3, .2) * gain


def reverb(x, secs=3.2, wet=.32):
    n = int(SR * secs); t = np.arange(n) / SR
    ir = lp(rng.normal(0, 1, n) * np.exp(-t * 6.9 / secs), 5500); ir /= np.sqrt(np.sum(ir ** 2))
    return x * (1 - wet) + signal.fftconvolve(x, ir)[:len(x)] * wet * 1.7


# ================= score (D minor) =================
music = np.zeros(N)
Dm, Bb, F, C = [50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]

# cold open braam, then low strings and a heartbeat
place(music, braam(38, 5.0, .8), HIT1)
place(music, strings([38, 45, 50], HIT2 + .5, a=3.5, r=1.2, cutoff=900, gain=1.1), .8)
place(music, strings([62, 65, 69], HIT2 - 4.5, a=3.0, r=1.5, cutoff=2000, gain=.55), 5.0)
for k in range(9):
    place(music, heartbeat(), 1.6 + k * 1.15, .55 + k * .05)
place(music, riser(1.4, 1.0), HIT2 - 1.4)

# main: epic drums + string ostinato, Dm Bb F C at 120 bpm (bar = 2 s)
BEAT, BAR = .5, 2.0
prog = [(Dm, 38), (Bb, 34), (F, 41), (C, 36)]
t0, bi = HIT2, 0
while t0 < BREAK - .01:
    chord, root = prog[bi % 4]
    d = min(BAR, BREAK - t0)
    place(music, strings([n + 12 for n in chord], d + .6, a=.08, r=.5, cutoff=2600, gain=.75), t0)
    place(music, strings([root, root + 12], d + .3, a=.05, r=.3, cutoff=500, gain=1.0), t0)
    for e in range(int(d / (BEAT / 2)) + 1):                       # 16th ostinato
        te = t0 + e * BEAT / 2
        if te >= BREAK: break
        nn = chord[[0, 2, 1, 3, 2, 1, 3, 2][e % 8]] + 12
        place(music, ostinato(nn, gain=.5 if e % 4 else .8), te)
    for b in range(4):
        tb = t0 + b * BEAT
        if tb >= BREAK: break
        place(music, tom(62 if b % 2 == 0 else 78, gain=1.0 if b == 0 else .7), tb)
        if b in (1, 3): place(music, snare_hit(.55), tb)
        if b == 3: place(music, tom(95, .4, .45), tb + BEAT / 2)
    t0 += BAR; bi += 1

# breakdown: everything drops to a clock and a heartbeat
place(music, strings([38, 45], FINAL - BREAK + .3, a=.8, r=.6, cutoff=600, gain=1.0), BREAK)
for k in range(int((FINAL - .35 - BREAK) / .5)):
    place(music, tick(2600 if k % 2 == 0 else 2100, .33), BREAK + .2 + k * .5)
for k in range(4):
    place(music, heartbeat(), BREAK + .6 + k * 1.3, .7)
place(music, riser(1.6, .8), FINAL - 1.85)          # cuts dead .25 s before the hit

# final: braam and a resolving F major
place(music, braam(41, 6.0, 1.0), FINAL)
place(music, strings([53, 57, 60, 65, 69], 5.6, a=.05, r=3.0, cutoff=3200, gain=1.0), FINAL)
for i, n in enumerate([77, 81, 84, 89]):
    place(music, bell(n, gain=.14), FINAL + .4 + i * .2)
music[int((FINAL - .25) * SR):int(FINAL * SR)] *= np.linspace(1, 0.05, int(.25 * SR))
music = reverb(music, 3.4, .3)

# ================= sound effects =================
sfx = np.zeros(N)
for at in (4.5, 8.9, 17.0, 21.4, 25.2, 30.2):
    place(sfx, whoosh(.8), at - .4, .9)
for i, at in enumerate((5.2, 5.75, 6.3, 6.85, 7.4)): place(sfx, pop(1000 + i * 90), at)
for i, at in enumerate((9.6, 9.9, 10.2, 10.5, 10.8)): place(sfx, pop(600 + i * 60, .22), at)
place(sfx, hit(1.0), HIT2)
for i, n in enumerate([74, 81, 86]): place(sfx, bell(n, gain=.12), HIT2 + .35 + i * .12)
for i, at in enumerate((19.1, 19.5, 19.9)): place(sfx, pop(1400 + i * 120, .26), at)
place(sfx, whoosh(.5, 600, 4500, .45), 23.0)
place(sfx, glide(300, 1000, 2.6), 26.0)
place(sfx, hit(.45), 28.6); place(sfx, bell(86, gain=.3), 28.62)
place(sfx, hit(.6), 33.8)                           # "would you be ready?" lands
place(sfx, hit(1.0), FINAL)
sfx = reverb(sfx, 2.2, .24)

# ================= voice =================
LD = sys.argv[1]
vo = np.zeros(N)
for name, at in CUES.items():
    p = os.path.join(LD, name + ".wav")
    with wave.open(p) if p.endswith('.wav') and False else open(p, 'rb') as _:
        pass
    import soundfile as sf
    x, sr = sf.read(p)
    if x.ndim > 1: x = x.mean(1)
    x = signal.resample_poly(x, SR, sr)
    place(vo, x, at)
OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
import soundfile as sf
sf.write(os.path.join(OUT, "vo_raw.wav"), vo / (np.abs(vo).max() + 1e-9) * .9, SR)
# broadcast chain: a semitone deeper, chest and presence, controlled dynamics, small room
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", os.path.join(OUT, "vo_raw.wav"), "-af",
                "asetrate=48000*0.9439,aresample=48000,atempo=1.0595,"
                "highpass=f=70,equalizer=f=140:t=q:w=1:g=3,equalizer=f=320:t=q:w=1.4:g=-2,"
                "equalizer=f=3200:t=q:w=1.2:g=2.5,equalizer=f=7800:t=q:w=2:g=-2.5,"
                "acompressor=threshold=-22dB:ratio=3.5:attack=4:release=140:makeup=5,"
                "aecho=0.7:0.45:28|57:0.14|0.08,alimiter=limit=0.9",
                os.path.join(OUT, "vo_proc.wav")], check=True)
vp, _ = sf.read(os.path.join(OUT, "vo_proc.wav"))
if vp.ndim > 1: vp = vp.mean(1)
vo = np.zeros(N); vo[:min(N, len(vp))] = vp[:N]

# ================= mix =================
e = lp(np.abs(vo), 6, 1); w = int(.15 * SR); e = np.convolve(e, np.ones(w) / w, mode="same")
duck = 1 - .5 * np.clip(e / (np.percentile(e[e > .002], 60) + 1e-9), 0, 1)
def nz(x, pk): return x / (np.abs(x).max() + 1e-9) * pk
music = nz(music, .55) * duck; sfx = nz(sfx, .5); vo = nz(vo, .9)
bed = music + sfx; d = int(.011 * SR)
L = vo + bed * .92 + np.concatenate([np.zeros(d), bed[:-d]]) * .1
R = vo + bed * .92 - np.concatenate([np.zeros(d), bed[:-d]]) * .1
fade = np.ones(N); fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR))
st = np.stack([L * fade, R * fade], 1); st = st / (np.abs(st).max() + 1e-9) * .95
sf.write(os.path.join(OUT, "mix.wav"), st, SR, subtype="PCM_16")
print("wrote", OUT)
