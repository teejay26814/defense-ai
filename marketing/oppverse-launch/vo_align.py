"""Cut a single voice-over take into its phrases and place each one on its beat.

    python3 vo_align.py take.wav            -> stems/vo.wav (48k stereo, on the film's timeline)
    python3 mix.py --vo stems/vo.wav        -> final film with voice, music ducked under it

Phrases are found by silence (>0.30s), then placed by PLACE below: phrase index -> start time.
The table matches VO-SCRIPT.md; if a new take splits differently, check the printed phrase list
and adjust PLACE (and TEMPO for any phrase that needs to be a touch quicker).
"""
import os, sys, subprocess
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
DUR = 53.0

# phrase -> film time (s). 26 phrases in the Sept 28 take.
PLACE = {
    0: 0.35,   # Somewhere, an opportunity just opened.
    1: 2.88,   # It's buried across fifty websites.
    2: 5.10,   # And then...
    3: 5.90,   # it's gone.                          (the noise collapses)
    4: 7.15,   # Opportunity should find the right person.
    5: 11.40,  # This is Oppverse AI.                (once the drop's boom has bloomed)
    6: 14.35,  # Build your profile once.
    7: 15.95,  # Your experience, your goals, your eligibility,
    8: 19.05,  # with a persona for every path.      (persona switch 19.31)
    9: 21.45,  # Jobs, fellowships, scholarships, grants and global programs.
    10: 26.10, # One universe.                       (fellowships lights up)
    11: 28.35, # Every match is scored across five layers, and explained.
    12: 32.25, # Not eligible?                       (screened card appears)
    13: 33.20, # It never reaches you.
    14: 35.60, # Ranked for you
    15: 36.95, # by fit, eligibility and deadline.
    16: 38.70, # Live.
    17: 41.20, # Save.       one word per pipeline stop
    18: 41.72, # Compare.
    19: 42.20, # Tailor.
    20: 42.64, # Track.
    21: 43.08, # Accepted.
    22: 44.30, # Stop searching everywhere.
    23: 45.75, # Start seeing what fits.
    24: 48.35, # Oppverse AI.                        (after the end hit)
    25: 49.50, # Build your opportunity profile today.
}
TEMPO = {0: 1.07, 1: 1.07,                       # the cold open is tight: a hair quicker, pitch kept
         17: 1.12, 18: 1.12, 19: 1.12, 20: 1.12, 21: 1.12}  # pipeline words land one per beat

def decode(path, sr, extra=()):
    raw = subprocess.run([FF, '-v', 'quiet', '-i', path, *extra, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def phrases(a, sr):
    w = sr // 100
    e = np.sqrt(np.add.reduceat(a[: len(a) // w * w] ** 2, np.arange(0, len(a) // w * w, w)) / w)
    db = 20 * np.log10(e + 1e-9); voiced = db > db.max() - 38
    segs, s, last = [], None, None
    for i, v in enumerate(voiced):
        t = i / 100
        if v:
            s = t if s is None else s; last = t
        elif s is not None and t - last > .30:
            segs.append((s, last + .01)); s = None
    if s is not None: segs.append((s, last + .01))
    return segs

def main():
    take = sys.argv[1]
    # voice chain: clean low end, gentle presence, broadcast-style levelling
    a = decode(take, SR, ['-af', 'highpass=f=85,equalizer=f=3200:t=q:w=1.2:g=2.5,equalizer=f=250:t=q:w=1:g=-1.5,'
                                 'acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=2'])
    segs = phrases(a, SR)
    for k, (s, e) in enumerate(segs):
        print(f'{k:2d}  {s:6.2f}-{e:6.2f}  ({e - s:4.2f}s) -> {PLACE.get(k, "UNPLACED")}')
    assert len(segs) == len(PLACE), f'take splits into {len(segs)} phrases, PLACE expects {len(PLACE)}'
    bus = np.zeros(int((DUR + 1) * SR), np.float32)
    for k, (s, e) in enumerate(segs):
        i0, i1 = int((s - .06) * SR), int((e + .14) * SR)      # keep breath-in and the natural decay
        p = a[max(0, i0):i1].copy()
        if k in TEMPO:
            raw = subprocess.run([FF, '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', f'atempo={TEMPO[k]}',
                                  '-f', 'f32le', '-'], input=p.tobytes(), capture_output=True, check=True).stdout
            p = np.frombuffer(raw, np.float32).copy()
        fi, fo = int(.012 * SR), int(.06 * SR)
        p[:fi] *= np.linspace(0, 1, fi); p[-fo:] *= np.linspace(1, 0, fo)
        at = int((PLACE[k] - .06) * SR)
        n = min(len(p), len(bus) - at); bus[at:at + n] += p[:n]
    bus *= .72 / np.abs(bus).max()
    out = os.path.join(HERE, 'stems', 'vo.wav'); os.makedirs(os.path.dirname(out), exist_ok=True)
    st = np.repeat(bus[:, None], 2, axis=1)
    subprocess.run([FF, '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', out],
                   input=st.astype(np.float32).tobytes(), check=True)
    # overlap check: no phrase may start before the previous one has finished
    ends = []
    for k, (s, e) in enumerate(segs):
        d = (e - s) / TEMPO.get(k, 1)
        ends.append((PLACE[k], PLACE[k] + d))
    for k in range(1, len(ends)):
        if ends[k][0] < ends[k - 1][1]:
            print(f'  OVERLAP: phrase {k} starts {ends[k][0]:.2f} before {k - 1} ends {ends[k - 1][1]:.2f}')
    print('->', out)

if __name__ == '__main__':
    main()
