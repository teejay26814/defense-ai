"""Original score, sound effects and final mix for the launch film.

Everything is synthesised here - no samples, no licences. Timings are in film seconds and
match the scene list in film.html (the voiceover starts at OFFSET).
usage: python3 sound.py <vo.wav> <out_dir>
"""
import sys, os, wave
import numpy as np
from scipy import signal

SR = 48000
DUR = 38.5
OFFSET = 0.8
rng = np.random.default_rng(7)
N = int(SR * DUR)


def t_axis(d):
    return np.arange(int(SR * d)) / SR


def place(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf):
        return
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n] * gain


def env_adsr(n, a, r, sustain=1.0):
    e = np.ones(n) * sustain
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, sustain, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------- instruments ----------

def saw(freq, d, detune=0.0):
    t = t_axis(d)
    f = freq * (1 + detune)
    out = np.zeros_like(t)
    for k in range(1, 9):
        out += np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) / k
    return out


def pad(notes, d, a=1.4, r=1.6, cutoff=1600):
    x = np.zeros(int(SR * d))
    for n in notes:
        for dt in (-0.0025, 0.0, 0.0025):
            x += saw(midi(n), d, dt)
    x = lowpass(x, cutoff) * env_adsr(len(x), a, r)
    return x / (len(notes) * 3) * 0.9


def pluck(n, d=1.6, bright=1.0):
    t = t_axis(d)
    f = midi(n)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * bright * np.sin(2 * np.pi * 2 * f * t) + 0.12 * bright * np.sin(2 * np.pi * 3 * f * t))
    e = np.exp(-t * 3.2) * np.minimum(1, t / 0.004)
    return x * e * 0.5


def bass(n, d):
    t = t_axis(d)
    f = midi(n)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return x * env_adsr(len(t), 0.01, 0.12) * 0.55


def kick():
    t = t_axis(0.45)
    f = 45 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5)
    x[:240] += rng.normal(0, 0.25, 240) * np.linspace(1, 0, 240)
    return x * 0.95


def hat():
    t = t_axis(0.06)
    return highpass(rng.normal(0, 1, len(t)), 7000) * np.exp(-t * 70) * 0.18


def clap():
    t = t_axis(0.22)
    x = bandpass(rng.normal(0, 1, len(t)), 900, 3200) * np.exp(-t * 22)
    return x * 0.38


def whoosh(d=0.7, lo=300, hi=3200, gain=0.5):
    n = int(SR * d)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    seg = 512
    for i in range(0, n, seg):
        p = i / n
        c = lo + (hi - lo) * np.sin(np.pi * p)
        out[i:i + seg] = bandpass(noise[i:i + seg] if i + seg <= n else noise[i:], c * 0.6, min(c * 1.6, 20000))
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return lowpass(out, 9000) * e * gain


def riser(d=1.1):
    n = int(SR * d)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    seg = 480
    for i in range(0, n, seg):
        c = 300 + 6000 * (i / n) ** 2
        out[i:i + seg] = bandpass(noise[i:i + seg], c * 0.7, min(c * 1.4, 22000))
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / d) ** 2) / SR) * 0.25
    e = (t / d) ** 2
    return (out * 0.6 + tone) * e * 0.55


def impact():
    t = t_axis(2.2)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 50 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    crack = lowpass(rng.normal(0, 1, len(t)), 2500) * np.exp(-t * 14) * 0.6
    return (boom + crack) * 0.9


def pop(f=1150, gain=0.35):
    t = t_axis(0.09)
    x = np.sin(2 * np.pi * f * t * (1 + 0.6 * np.exp(-t * 60))) * np.exp(-t * 55)
    return x * gain


def bell(n, d=2.4, gain=0.3):
    t = t_axis(d)
    f = midi(n)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 3) + 0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 5)
    return x * np.exp(-t * 1.6) * np.minimum(1, t / 0.003) * gain


def glide(f0, f1, d, gain=0.12):
    t = t_axis(d)
    f = f0 * (f1 / f0) ** (t / d)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return x * env_adsr(len(t), 0.3, 0.2) * gain


def reverb(x, secs=2.4, wet=0.28):
    n = int(SR * secs)
    t = np.arange(n) / SR
    ir = rng.normal(0, 1, n) * np.exp(-t * 3.0 / secs * 2.3)
    ir = lowpass(ir, 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    tail = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - wet) + tail * wet * 1.6


# ---------- score ----------
music = np.zeros(N)
BEAT = 0.6           # 100 bpm
BAR = BEAT * 4
DROP = 10.6
BREAK = 29.1
FINAL = 33.7

Am = [57, 60, 64, 71]      # A3 C4 E4 B4 (add9 colour)
F = [53, 57, 60, 64]       # F3 A3 C4 E4 (maj7)
C = [48, 55, 60, 64, 67]   # C3 G3 C4 E4 G4
G = [55, 59, 62, 67]       # G3 B3 D4 G4
Gsus = [55, 60, 62, 67]

# intro: two long pads and a sparse piano figure
place(music, pad(Am, 5.6, a=2.0), 0.0, 0.8)
place(music, pad(F, 5.6), 5.2, 0.8)
arp_intro = [69, 72, 76, 72, 71, 72, 76, 79]
for i in range(16):
    tt = 0.6 + i * BEAT
    if tt > DROP - 0.4:
        break
    chord_top = arp_intro if tt < 5.2 else [65, 69, 72, 69, 64, 69, 72, 76]
    place(music, pluck(chord_top[i % 8], bright=0.7), tt, 0.32)
place(music, riser(1.15), DROP - 1.15, 0.9)

# main section: Am F C G, kick on every beat, clap on 2 and 4, hats on the off-beats
prog = [(Am, 45), (F, 41), (C, 36), (G, 43)]
bar_i = 0
t0 = DROP
while t0 < BREAK - 0.01:
    chord, root = prog[bar_i % 4]
    d = min(BAR, BREAK - t0)
    place(music, pad(chord, d + 0.8, a=0.15, r=0.7, cutoff=2400), t0, 0.62)
    for b in range(4):
        tb = t0 + b * BEAT
        if tb >= BREAK:
            break
        place(music, kick(), tb, 0.85)
        place(music, hat(), tb + BEAT / 2, 1.0)
        if b in (1, 3):
            place(music, clap(), tb, 1.0)
        for e8 in (0, 0.5):
            place(music, bass(root, BEAT * 0.45), tb + e8 * BEAT, 0.9)
        place(music, pluck(chord[(b * 2) % len(chord)] + 12, d=0.9), tb, 0.18)
        place(music, pluck(chord[(b * 2 + 1) % len(chord)] + 12, d=0.9), tb + BEAT / 2, 0.14)
    t0 += BAR
    bar_i += 1

# breakdown: drums out, tension on F then G-sus
place(music, pad(F, 2.6, a=0.3), BREAK, 0.75)
place(music, pad(Gsus, 2.6, a=0.6), BREAK + 2.3, 0.75)
place(music, riser(1.0), FINAL - 1.0, 0.55)

# resolve
place(music, pad(C, 4.8, a=0.05, r=2.6, cutoff=3000), FINAL, 0.95)
place(music, bass(36, 3.5) * np.exp(-t_axis(3.5) * 0.6), FINAL, 1.2)
place(music, kick(), FINAL, 1.0)
for i, n in enumerate([72, 76, 79, 84, 88]):
    place(music, bell(n, gain=0.18), FINAL + 0.25 + i * 0.18)

music = reverb(music, 2.6, 0.3)

# ---------- sound effects ----------
sfx = np.zeros(N)
for at in (3.65, 7.45, 15.15, 20.45, 23.95, 29.05):
    place(sfx, whoosh(0.75), at - 0.35, 0.8)
for i, at in enumerate((4.2, 4.75, 5.3, 5.85, 6.4)):      # question cards
    place(sfx, pop(1050 + i * 90), at, 1.0)
for i, at in enumerate((7.85, 8.15, 8.45, 8.75, 9.05)):  # chapter cards
    place(sfx, pop(620 + i * 60, 0.25), at, 1.0)
place(sfx, impact(), DROP, 1.0)
for i, n in enumerate([79, 84, 88]):                     # logo shimmer
    place(sfx, bell(n, gain=0.14), DROP + 0.3 + i * 0.12)
for i, at in enumerate((17.0, 17.45, 17.9)):             # citation chips
    place(sfx, pop(1400 + i * 120, 0.28), at, 1.0)
place(sfx, whoosh(0.5, 600, 4200, 0.45), 21.75, 1.0)    # card flip
place(sfx, whoosh(0.5, 600, 4200, 0.45), 23.0, 1.0)
place(sfx, glide(330, 990, 2.6), 24.7, 1.0)              # ring filling
place(sfx, bell(84, gain=0.35), 27.3)                    # score lands
place(sfx, bell(91, gain=0.2), 27.35)
place(sfx, impact() * 0.8, FINAL, 1.0)
sfx = reverb(sfx, 1.6, 0.22)

# ---------- voice, ducking and mix ----------
w = wave.open(sys.argv[1])
assert w.getframerate() == SR
vo_raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
vo = np.zeros(N)
place(vo, highpass(vo_raw, 80), OFFSET, 1.0)

envl = np.abs(vo)
envl = lowpass(envl, 6, 1)
envl = np.convolve(envl, np.ones(int(0.15 * SR)) / int(0.15 * SR), mode="same")
duck = 1 - 0.55 * np.clip(envl / (np.percentile(envl[envl > 0.002], 60) + 1e-9), 0, 1)

def norm(x, peak):
    return x / (np.abs(x).max() + 1e-9) * peak

music = norm(music, 0.5) * duck
sfx = norm(sfx, 0.45)
vo = norm(vo, 0.85)
mix = music + sfx + vo

# gentle stereo: music and sfx widened with a short Haas delay; voice dead centre
d = int(0.012 * SR)
side = np.concatenate([np.zeros(d), (music + sfx)[:-d]])
L = vo + (music + sfx) * 0.9 + side * 0.1
R = vo + (music + sfx) * 0.9 - side * 0.1 + np.concatenate([np.zeros(d // 2), (music + sfx)[:-(d // 2)]]) * 0.08
fade = np.ones(N)
fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
st = np.stack([L * fade, R * fade], axis=1)
st = st / (np.abs(st).max() + 1e-9) * 0.95

out = sys.argv[2]
os.makedirs(out, exist_ok=True)
for name, data in (("mix.wav", st), ("music.wav", np.stack([music, music], 1)), ("sfx.wav", np.stack([sfx, sfx], 1))):
    with wave.open(os.path.join(out, name), "w") as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((np.clip(data, -1, 1) * 32767).astype(np.int16).tobytes())
print("wrote", out, f"{DUR}s")
