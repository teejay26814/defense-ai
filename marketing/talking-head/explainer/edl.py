"""Turn the picked takes into a frame-accurate cut list.

    python3 explainer/edl.py explainer/ai-automation-01.json  -> work/<name>/edl.json

Each segment is a word-aligned range of the raw take. Inside it, pauses over GAP are cut out
(jump cuts), listed filler words are dropped, and every edge is refined on the audio energy so
no word is clipped: starts back off to the last quiet frame, ends run on through the decay.
The output maps every kept word onto the edited timeline for captions and graphics.
"""
import os, sys, json, subprocess
import numpy as np
import imageio_ffmpeg

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR, GAP, FPS = 48000, 0.30, 30

cfg = json.load(open(sys.argv[1]))
T = json.load(open(os.path.join(HERE, cfg['transcript'])))
words = [(w[0], w[1], w[2].strip()) for s in T for w in s['words']]
raw = subprocess.run([FF, '-v', 'quiet', '-i', os.path.join(HERE, cfg['audio']), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
a = np.frombuffer(raw, np.float32)
hop = SR // 100
db = 20 * np.log10(np.sqrt(np.add.reduceat(a[:len(a) // hop * hop] ** 2, np.arange(0, len(a) // hop * hop, hop)) / hop) + 1e-9)
thr = np.percentile(db, 10) + 12
loud = lambda t: db[min(len(db) - 1, max(0, int(t * 100)))] > thr

def refine(start, end, lo, hi, tight=False):
    # lo/hi are the neighbouring words in the raw take (kept or not), so an edge never runs into them
    s = start
    while not tight and s > max(lo, start - .2) and loud(s - .01): s -= .01
    e = end
    while e < min(hi, end + .18) and loud(e + .01): e += .01
    return max(lo, s - .03), min(hi, e + .05)

fix = {round(float(k), 2): v for k, v in cfg.get('fix', {}).items()}
cuts, out_words, t_out = [], [], 0.0
for si, seg in enumerate(cfg['segments']):
    a0, b0 = seg['range']; drop = [round(d, 2) for d in seg.get('drop', [])]
    ws = [w for w in words if w[0] >= a0 - .01 and w[1] <= b0 + .01 and round(w[0], 2) not in drop]
    runs, cur = [], [ws[0]]
    for w in ws[1:]:
        dropped_between = any(cur[-1][1] - .01 <= d <= w[0] + .01 for d in drop)
        if w[0] - cur[-1][1] > GAP or dropped_between: runs.append(cur); cur = [w]
        else: cur.append(w)
    runs.append(cur)
    for ri, r in enumerate(runs):
        prev = [w for w in words if w[1] <= r[0][0] + .005 and w is not r[0]]
        nxt = [w for w in words if w[0] >= r[-1][1] - .005 and w is not r[-1]]
        lo = max(prev[-1][1] if prev else 0, r[0][0] - .25) + .01
        hi = min(nxt[0][0] if nxt else 1e9, r[-1][1] + .3) - .01
        s, e = refine(r[0][0], r[-1][1], lo, hi, tight=seg.get('tight') and ri == 0)
        s, e = round(s * FPS) / FPS, round(e * FPS) / FPS          # frame-aligned
        cuts.append({'in': s, 'out': e, 'zoom': seg['zoom'], 'seg': si, 'beat': seg.get('beat') if ri == 0 else None, 't': t_out})
        for w in r:
            out_words.append({'t0': round(t_out + w[0] - s, 3), 't1': round(t_out + w[1] - s, 3), 'w': fix.get(round(w[0], 2), w[2]), 'seg': si})
        t_out += e - s
work = os.path.join(HERE, 'work', cfg['name']); os.makedirs(work, exist_ok=True)
json.dump({'cuts': cuts, 'words': out_words, 'duration': round(t_out, 3)}, open(os.path.join(work, 'edl.json'), 'w'), indent=1)
print(f'{len(cuts)} cuts, {t_out:.1f}s')
seg_text = {}
for w in out_words: seg_text.setdefault(w['seg'], []).append(w['w'])
for si, ws in seg_text.items():
    c = [x for x in cuts if x['seg'] == si][0]
    print(f"{c['t']:6.2f}  z{c['zoom']}  {' '.join(ws)}")
