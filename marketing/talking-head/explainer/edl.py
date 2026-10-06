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
SIL, PAD, PAD_END = 0.22, 0.07, 0.12      # silences longer than SIL inside a phrase are cut, keeping PAD of air each side

cfg = json.load(open(sys.argv[1]))
# one or more source takes: {"sources": {"A": {"video", "transcript", "audio"}, ...}}, segments pick one with "src"
SRC = cfg.get('sources') or {'_': {'video': cfg.get('source'), 'transcript': cfg['transcript'], 'audio': cfg['audio']}}
def load(spec):
    T = json.load(open(os.path.join(HERE, spec['transcript'])))
    ws = [(w[0], w[1], w[2].strip()) for s in T for w in s['words']]
    raw = subprocess.run([FF, '-v', 'quiet', '-i', os.path.join(HERE, spec['audio']), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32); hop = SR // 100
    d = 20 * np.log10(np.sqrt(np.add.reduceat(a[:len(a) // hop * hop] ** 2, np.arange(0, len(a) // hop * hop, hop)) / hop) + 1e-9)
    return ws, d, np.percentile(d, 10) + 12
LOADED = {k: load(v) for k, v in SRC.items()}
words, db, thr = None, None, None
loud = lambda t: db[min(len(db) - 1, max(0, int(t * 100)))] > thr

def refine(start, end, lo, hi, tight=False):
    # lo/hi are the neighbouring words in the raw take (kept or not), so an edge never runs into them
    s = start
    while not tight and s > max(lo, start - .2) and loud(s - .01): s -= .01
    e = end
    while e < min(hi, end + .18) and loud(e + .01): e += .01
    return max(lo, s - .03), min(hi, e + .05)

cuts, out_words, t_out = [], [], 0.0
for si, seg in enumerate(cfg['segments']):
    src = seg.get('src', next(iter(SRC))); words, db, thr = LOADED[src]
    fsrc = cfg.get('fix', {}).get(src, {}) if 'sources' in cfg else cfg.get('fix', {})
    fix = {round(float(k), 2): v for k, v in fsrc.items() if ':' not in k}
    fixw = {k.split(':')[0] + ':' + k.split(':')[1].lower(): v for k, v in fsrc.items() if ':' in k}
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
        if ri == len(runs) - 1 and seg.get('tail'): e = min(hi, max(e, r[-1][1] + seg['tail']))   # last word runs long (e.g. '2pm')
        # silences inside the run (whisper often folds a pause into a word's duration): cut them too
        f0, f1 = int(s * 100) + 1, int(e * 100)
        quiet = db[f0:f1] <= thr
        # lip smacks / breaths: a loud blip under 0.12 s with quiet either side counts as silence
        k = 0
        while k < len(quiet):
            if not quiet[k]:
                j = k
                while j < len(quiet) and not quiet[j]: j += 1
                if j - k < 12 and k > 0 and j < len(quiet): quiet[k:j] = True
                k = j
            else: k += 1
        for c0, c1 in seg.get('cutouts', []):                    # hand-marked hums / fillers inside a phrase
            quiet[max(0, int(c0 * 100) - f0):max(0, int(c1 * 100) - f0)] = True
        pieces, p0, q = [], s, None
        for i, f in enumerate(range(f0, f1)):
            if quiet[i]: q = f if q is None else q
            else:
                if q is not None and (f - q) / 100 >= SIL:
                    sent_end = any(abs(w[1] - q / 100) < .25 and w[2][-1:] in '.?!' for w in r)
                    pad = PAD_END if sent_end else PAD
                    pieces.append((p0, q / 100 + pad)); p0 = f / 100 - pad
                q = None
        pieces.append((p0, e))
        # a piece that holds no word's middle is a stray sound, not speech
        pieces = [(ps, pe) for ps, pe in pieces if any(ps <= (w[0] + w[1]) / 2 <= pe or (w[0] >= ps and w[0] <= pe - .12) for w in r)] or pieces
        mapped = []
        for k, (ps, pe) in enumerate(pieces):
            ps, pe = round(ps * FPS) / FPS, round(pe * FPS) / FPS          # frame-aligned
            if pe - ps < 2 / FPS: continue
            cuts.append({'in': ps, 'out': pe, 'src': src, 'zoom': seg['zoom'], 'seg': si, 'beat': seg.get('beat') if ri == 0 and k == 0 else None, 't': round(t_out, 4)})
            mapped.append((ps, pe, t_out)); t_out += pe - ps
        def m(t):                                                   # raw-take time -> edited time
            for ps, pe, to in mapped:
                if t <= pe: return to + max(0, t - ps)
            ps, pe, to = mapped[-1]; return to + pe - ps
        for w in r:
            fx = fixw.get(f'{w[0]:.2f}:{w[2].lower()}', fix.get(round(w[0], 2), w[2]))
            out_words.append({'t0': round(m(w[0]), 3), 't1': round(m(w[1]), 3), 'w': fx, 'seg': si})
work = os.path.join(HERE, 'work', cfg['name']); os.makedirs(work, exist_ok=True)
json.dump({'cuts': cuts, 'words': out_words, 'duration': round(t_out, 3)}, open(os.path.join(work, 'edl.json'), 'w'), indent=1)
print(f'{len(cuts)} cuts, {t_out:.1f}s')
seg_text = {}
for w in out_words: seg_text.setdefault(w['seg'], []).append(w['w'])
for si, ws in seg_text.items():
    c = [x for x in cuts if x['seg'] == si][0]
    print(f"{c['t']:6.2f}  z{c['zoom']}  {' '.join(ws)}")
