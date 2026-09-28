"""Sound design + mix for the Oppverse launch film.

    python3 mix.py                      -> oppverse-launch_final.mp4 (+ stems/)
    python3 mix.py --vo voice.wav       -> same, with the voice-over on top and the music ducked under it

Every cue is placed by its *hit point* (the file's measured peak), so the transient lands on the
exact frame of the visual event, not wherever the file happens to start. Levels are set as a target
peak (0..1) per cue, so they are independent of how loud each source file was mastered.
Sources: the SAMADSMETT SFX pack (marketing/motion-busywork/sfx, not committed).
"""
import subprocess, sys, os, math, json
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '..', 'motion-busywork', 'sfx')
VIDEO = os.path.join(HERE, 'oppverse-launch.mp4')
OUT = os.path.join(HERE, 'oppverse-launch_final.mp4')
SR = 48000
DUR = 53.0

MUSIC = ('mixkit-21-445', 3.8)   # track, offset in seconds: its drop (14.21s) lands on the logo at 10.41s

def load(name):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', os.path.join(SFX, name + '.mp3'), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()

_cache = {}
def src(name):
    if name not in _cache:
        a = load(name)
        env = np.abs(a).max(axis=1)
        w = SR // 100
        blocks = env[: len(env) // w * w].reshape(-1, w).max(axis=1)
        _cache[name] = (a, blocks.argmax() * w / SR, env.max())
    return _cache[name]

# (file, hit time in film, target peak, options)   options: align='peak'|'start', len=seconds kept after start, fade=out-fade seconds
C = []
def cue(f, t, lvl, **o): C.append((f, t, lvl, o))

# ---- S1 the problem --------------------------------------------------------------------------
cue('07_Subsonic_A', 0.25, .15, align='start', fade=2.0)
# fragments land: 32 arrivals on a sqrt schedule (same formula as the picture), sounded on every other one
clicks = ['rm_click__2_', 'Pop_1', 'mixkit-hard-pop-click-2364', 'rm_click__3_', 'Mouse_Click', 'keyboard_press']
for j, k in enumerate(range(0, 32, 2)):
    t = 1.1 + 3.5 * math.sqrt(k / 32) + .12
    cue(clicks[j % len(clicks)], t, .07 + .11 * (j / 15))
for t in (1.9, 3.45, 4.35):
    cue('Iphone_Receive', t, .09)
cue('mixkit-cinematic-wind-swoosh-1471', 3.15, .22)
cue('10_Access_Denied', 5.02, .30, fade=1.0, len=2.2)
cue('ES_Riser_Suction_5_-_SFX_Producer', 6.38, .42)
cue('ES_Suction_Pop_5_-_SFX_Producer', 6.42, .30)
# ---- S2 the turn -----------------------------------------------------------------------------
cue('shot_light_energy', 6.62, .30, fade=1.5, len=3.2)
cue('mixkit-cinematic-transition-wind-swoosh-1468', 7.35, .20)
cue('clean-fast-swooshaiff-14784', 10.0, .20)
cue('BUILD-UP', 10.36, .50)
# ---- S3 logo (drop) --------------------------------------------------------------------------
cue('11_Universe_Boom_A', 10.41, .50, fade=2.5)
cue('fast-whoosh-118248', 10.56, .24)
cue('rm_click__2_', 12.0, .18)
cue('Swoosh', 13.82, .26)
# ---- S4 profile ------------------------------------------------------------------------------
cue('Whoosh_2', 14.45, .18)
for b in (14.86, 15.31, 15.75, 16.19):
    for d in (0, .11, .22, .34):
        cue('keyboard_press', b + d, .13)
    cue('Pop_1', b + .52, .13)
cue('01_Processing', 16.95, .18)
cue('11_Access_Granted', 17.6, .30)
cue('Game_Menu_Select_Sound_Effect', 19.36, .30)
cue('mixkit-in-and-out-zoom-sound-2622', 20.95, .30)
# ---- S5 universe -----------------------------------------------------------------------------
cue('mixkit-space-impact-774', 21.12, .34, fade=1.2, len=2.0)
cue('16_Network_Connect', 21.3, .22, fade=.8, len=2.0)
for k in range(8):
    cue('Pop_1' if k % 2 else 'rm_click__3_', 21.09 + .55 + k * .115 + .26, .12)
cue('Digital_counting', 22.0, .20, align='start', len=2.1, fade=.5)
cue('Mountain_Audio_-_New_Idea_Notification', 26.5, .22)
cue('woosh-building-109596', 28.12, .26)
# ---- S6 match explained ----------------------------------------------------------------------
cue('06_Portal_Hop', 28.22, .18, fade=.5, len=.9)   # clear of the voice's 'Every'
cue('Whoosh_2', 28.8, .08)
cue('09_Data_Transfer', 29.25, .16, fade=.6, len=1.6)
# the music breaks down 26-31s: a robotic riser carries the explanation and cuts dead on the 92% lock
cue('10_Evolve_Riser_Robo_Drums', 23.72, .34, align='start', len=7.63, fade=.12)
for b in (29.10, 29.55, 29.99, 30.44, 30.88):
    cue('rm_click__2_', b, .17)
    cue('Pop_1', b + .6, .10)
cue('Digital_counting', 29.1, .18, align='start', len=2.1, fade=.4)
cue('correct_sfx', 31.36, .28)
cue('Whoosh_2', 32.35, .14)
cue('17_Disconnected', 32.72, .22, fade=.6, len=1.4)
cue('clean-fast-swooshaiff-14784', 33.85, .16)
cue('mixkit-cinematic-transition-wind-swoosh-1468', 35.2, .26)
# ---- S7 ranked, live -------------------------------------------------------------------------
cue('06_Portal_Hop', 35.62, .22, fade=.6, len=1.2)
for k in range(3):
    cue('Pop_1', 36.13 + k * .14, .13)
cue('Digital_counting', 36.2, .14, align='start', len=1.2, fade=.3)
cue('Swoosh', 37.5, .26)
cue('Ding', 37.85, .22)
cue('Whoosh_2', 40.5, .16)
# ---- S8 pipeline -----------------------------------------------------------------------------
for t in (41.3, 41.78, 42.23, 42.67):
    cue('mixkit-hard-pop-click-2364', t, .16)
cue('quick-win', 43.02, .18)            # just ahead of the voice's 'Accepted'
cue('Short_Whoosh', 44.12, .18)
# ---- S9 close --------------------------------------------------------------------------------
cue('mixkit-cinematic-wind-swoosh-1471', 44.62, .18)
cue('mixkit-cinematic-wind-swoosh-1471', 45.78, .16)
cue('BUILD-UP', 47.74, .50)
cue('03_Grand_Hit_A', 47.79, .58, len=.9, fade=.7)   # short tail: the brand name follows
cue('rm_click__2_', 49.05, .18)


def place(bus, a, start):
    i0 = int(round(start * SR))
    if i0 < 0: a, i0 = a[-i0:], 0
    n = min(len(a), len(bus) - i0)
    if n > 0: bus[i0:i0 + n] += a[:n]

def build_sfx():
    bus = np.zeros((int(DUR * SR) + SR, 2), np.float32)
    for f, t, lvl, o in C:
        a, pk_t, pk = src(f)
        a = a * (lvl / max(pk, 1e-6))
        start = t - (0 if o.get('align') == 'start' else pk_t)
        keep = o.get('len')                      # seconds kept after the hit point
        if keep:
            a = a[: int((keep + (0 if o.get('align') == 'start' else pk_t)) * SR)].copy()
        fade = o.get('fade')
        if fade:
            n = min(len(a), int(fade * SR))
            a = a.copy(); a[-n:] *= np.linspace(1, 0, n, dtype=np.float32)[:, None] ** 2
        place(bus, a, start)
    return bus

def build_music():
    name, off = MUSIC
    a, _, pk = src(name)
    a = a[int(off * SR):].copy()
    bus = np.zeros((int(DUR * SR) + SR, 2), np.float32)
    n = min(len(a), len(bus)); bus[:n] = a[:n]
    tt = np.arange(len(bus)) / SR
    g = np.clip(tt / 0.6, 0, 1)                                   # fade in
    g *= np.clip((DUR - .3 - tt) / 2.4, 0, 1) ** 1.5              # fade out into the end card
    g *= np.where(tt < 10.3, .7, 1.0)                             # hold the cold open back so the drop hits
    return bus * g[:, None] * .52

def wav(path, a):
    subprocess.run([FF, '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path],
                   input=np.ascontiguousarray(a, np.float32).tobytes(), check=True)

def main():
    vo = sys.argv[sys.argv.index('--vo') + 1] if '--vo' in sys.argv else None
    os.makedirs(os.path.join(HERE, 'stems'), exist_ok=True)
    sfx, music = build_sfx(), build_music()
    if vo:
        raw = subprocess.run([FF, '-v', 'quiet', '-i', vo, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        v = np.frombuffer(raw, np.float32).reshape(-1, 2)
        vbus = np.zeros_like(music); vbus[: min(len(v), len(vbus))] = v[: len(vbus)]
        # duck music (-10.5 dB) and soften SFX wherever the voice is speaking: 60ms envelope
        env = np.abs(vbus).max(axis=1)
        k = int(.06 * SR); env = np.convolve(env, np.ones(k) / k, 'same')
        vbus *= 1.5                                                 # voice leads the mix
        duck = 1 - .70 * np.clip(env / .05, 0, 1)
        duck = np.convolve(duck, np.ones(k * 4) / (k * 4), 'same')
        music *= duck[:, None]; sfx *= (0.28 + 0.72 * duck)[:, None]
        mix = music + sfx + vbus
    else:
        mix = music + sfx
    wav(os.path.join(HERE, 'stems', 'music.wav'), music)
    wav(os.path.join(HERE, 'stems', 'sfx.wav'), sfx)
    mixpath = os.path.join(HERE, 'stems', 'mix.wav')
    wav(mixpath, mix)
    # master: gentle glue compression, then ONE static gain to -14 LUFS (social platforms) and a
    # -1 dBTP limiter. Static on purpose: a dynamic normaliser would lift the quiet cold open up
    # to the level of the drop and flatten the story.
    glue = 'acompressor=threshold=-18dB:ratio=2.5:attack=15:release=180:makeup=1'
    meas = subprocess.run([FF, '-nostats', '-i', mixpath, '-af', glue + ',ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    integrated = float(meas[meas.rindex('I:'):].split()[1])
    gain = -14.0 - integrated
    print('integrated %.1f LUFS -> gain %+.1f dB' % (integrated, gain))
    subprocess.run([FF, '-y', '-v', 'error', '-i', VIDEO, '-i', mixpath,
                    '-filter_complex', f'[1:a]{glue},volume={gain:.2f}dB,alimiter=limit=0.84:attack=4:release=60:level=disabled,aresample=48000[a]',
                    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-b:v', '10M', '-maxrate', '14M', '-bufsize', '20M', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-t', str(DUR), '-movflags', '+faststart', OUT], check=True)
    print('cues:', len(C), '->', OUT)

if __name__ == '__main__':
    main()
