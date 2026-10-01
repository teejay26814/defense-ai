"""Multi-clip talking-head reel (v2): several camera takes + screen-recording B-roll.

    python3 reel.py projects/nurse-01.json                 # all stages
    python3 reel.py projects/nurse-01.json --stage edl|base|data|overlay|audio|final

Differences from edit.py (single clip):
  * keeps reference a source: [src, start, end, zoom]; edges are snapped to the quietest 10 ms
    within +-snap seconds, so cuts land in the gaps between words (razor-tight, no clipped syllables)
  * camera sources are corrected with a hand-built 3D LUT (grade_lut.py) instead of a filter stack
  * B-roll: screen-recording crops shown as rounded cards over a blurred, navy-dimmed copy of
    themselves, overlaid on the talking timeline while the voice continues
"""
import json, os, re, subprocess, sys
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '..', 'motion-busywork', 'sfx')
W, H, FPS, SR = 1080, 1920, 30, 48000
TO_SDR = 'colorspace=all=bt709:iall=bt2020:itrc=bt709:format=yuv420p'
TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']

def run(cmd, **kw): return subprocess.run(cmd, check=True, **kw)
def norm(w): return re.sub(r"[^a-z0-9']", '', w.lower())

def load(path):
    c = json.load(open(path)); c['work'] = os.path.join(HERE, 'work'); c['out'] = os.path.join(HERE, 'out')
    os.makedirs(c['work'], exist_ok=True); os.makedirs(c['out'], exist_ok=True); return c
def p(c, suf): return os.path.join(c['work'], c['name'] + suf)

def decode(path, extra=(), ch=1, sr=SR):
    raw = run([FF, '-v', 'quiet', '-i', path, *extra, '-vn', '-ac', str(ch), '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()

# ------------------------------------------------------------------ edl (snap cut points)
def stage_edl(c):
    env = {}
    for k, path in c['sources'].items():
        if c.get('camera', {}).get(k, True) is False: continue
        a = decode(os.path.join(HERE, path), sr=16000)[:, 0]
        n = len(a) // 160; e = np.sqrt((a[:n * 160].reshape(n, 160) ** 2).mean(1))
        env[k] = 20 * np.log10(e + 1e-9)                       # 10 ms frames
    # keeps are given as [src, first-word-start, last-word-start, zoom]; each edge is found in the audio:
    # start = where the voice begins (searching back from the word), end = where the last word decays
    out, off = [], 0.0
    for kp in c['keeps']:
        src, s, e, z = kp[:4]; opt = kp[4] if len(kp) > 4 else {}
        db = env[src]; thr = np.percentile(db, 10) + c.get('vad_db', 12)
        quiet = db < thr
        ws = json.load(open(os.path.join(HERE, c['words'][src])))
        fi = min(range(len(ws)), key=lambda k: abs(ws[k][0] - s)); li = min(range(len(ws)), key=lambda k: abs(ws[k][0] - e))
        lo = ws[fi - 1][1] - 0.05 if fi > 0 else s - 0.45                 # can't start before the previous word ends
        hi = ws[li + 1][0] if li + 1 < len(ws) else e + 1.2              # can't end after the next word starts
        def run_quiet(a, b, n):                                          # first index in [a,b) with n quiet frames
            for k in range(max(0, a), max(0, b)):
                if quiet[k:k + n].all(): return k
            return None
        # start: last quiet frame before the voice comes in
        i = int((s + 0.06) * 100); lo_i = int(max(lo, s - 0.45) * 100)
        while i > lo_i and not quiet[i - 3:i].all(): i -= 1
        if i <= lo_i:                                                    # no pause before it: cut in the dip right before the word
            a0, b0 = int((s - 0.10) * 100), int((s + 0.03) * 100)
            s2 = (a0 + int(np.argmin(db[a0:b0]))) / 100
        else:
            s2 = max(0, i / 100 - 0.03)
        # end: first sustained quiet after the last word, never past the next word
        k = run_quiet(int((e + 0.10) * 100), int((hi - 0.02) * 100), 12)   # 120 ms: stops/fricatives inside a word are not a pause
        if k is None:                                                    # continuous speech: cut in the dip before the next word
            a, b = int((hi - 0.18) * 100), int((hi - 0.01) * 100)
            k = a + int(np.argmin(db[a:b])) if b > a else int(hi * 100)
            e2 = k / 100
        else:
            e2 = min(k / 100 + 0.05, hi - 0.01)
        e2 += opt.get('pad_end', 0)
        out.append({'src': src, 's': round(s2, 3), 'e': round(e2, 3), 'z': z, 'off': round(off, 3)}); off += e2 - s2
    json.dump({'keeps': out, 'dur': round(off, 3)}, open(p(c, '.edl.json'), 'w'), indent=1)
    print(f'edl: {len(out)} cuts, {off:.2f}s')
    for k in out: print(f"  {k['off']:6.2f}  {k['src']:5s} {k['s']:7.2f}-{k['e']:7.2f}  z{k['z']}")

def edl(c): return json.load(open(p(c, '.edl.json')))

# ------------------------------------------------------------------ b-roll assets
def backdrop(c):
    path = p(c, '_backdrop.png')
    if os.path.exists(path): return path
    yy, xx = np.mgrid[0:H, 0:W]
    d1 = np.hypot((xx - W * 0.5) / W, (yy - H * 0.40) / H)
    d2 = np.hypot((xx - W * 0.85) / W, (yy - H * 0.12) / H)
    navy, deep, blue = np.array([11, 26, 46]), np.array([5, 12, 24]), np.array([37, 99, 235])
    img = navy * (1 - np.clip(d1 * 1.4, 0, 1))[..., None] + deep * np.clip(d1 * 1.4, 0, 1)[..., None]
    img = img + blue * (0.16 * np.exp(-(d2 / 0.35) ** 2))[..., None]
    img = img + np.random.default_rng(3).normal(0, 2.2, img.shape)      # fine grain: no banding
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(path); return path

def card_assets(c, i, w, h, r=30):
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    mp = p(c, f'_mask{i}.png'); m.save(mp)
    bd = Image.new('RGBA', (w, h), (0, 0, 0, 0)); ImageDraw.Draw(bd).rounded_rectangle((0, 0, w - 1, h - 1), r, outline=(255, 255, 255, 46), width=2)
    bp = p(c, f'_border{i}.png'); bd.save(bp)
    pad = 90; sh = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + 24, pad + w, pad + h + 24), r, fill=(2, 8, 20, 190))
    sh = sh.filter(ImageFilter.GaussianBlur(34)); sp = p(c, f'_shadow{i}.png'); sh.save(sp)
    return mp, sp, bp, pad

# ------------------------------------------------------------------ base video
def stage_base(c):
    E = edl(c); D = E['dur']; T = c['tail']
    srcs = list(c['sources']); idx = {k: i for i, k in enumerate(srcs)}
    ins = []
    for k in srcs: ins += ['-i', os.path.join(HERE, c['sources'][k])]
    n_in = len(srcs)
    lut = os.path.join(HERE, c['lut'])
    fc, n = [], len(E['keeps'])
    for i, k in enumerate(E['keeps']):
        zw, zh = int(W * k['z']) // 2 * 2, int(H * k['z']) // 2 * 2
        ay = c.get('anchor_y', 0.4)
        fc.append(f"[{idx[k['src']]}:v]trim=start={k['s']}:end={k['e']},setpts=PTS-STARTPTS,"
                  f"scale={zw}:{zh}:flags=lanczos,{TO_SDR},crop={W}:{H}:{(zw - W) // 2}:{int((zh - H) * ay)},"
                  f"format=rgb24,lut3d='{lut}':interp=tetrahedral,setsar=1,fps={FPS},format=yuv420p[v{i}]")
        d = k['e'] - k['s']
        fc.append(f"[{idx[k['src']]}:a]atrim=start={k['s']}:end={k['e']},asetpts=PTS-STARTPTS,"
                  f"afade=t=in:d=0.012,afade=t=out:st={d - 0.015:.3f}:d=0.015[a{i}]")
    fc.append(''.join(f'[v{i}][a{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=1[vc][ac]')
    cur = f"[vc]vignette=angle=PI/7,tpad=stop_mode=clone:stop_duration={T},boxblur=luma_radius=22:luma_power=2:enable='gte(t,{D + 0.1:.3f})'[v_0]"
    fc.append(cur); last = 'v_0'
    # b-roll cards
    scr_i = idx[c['broll_source']]
    for j, b in enumerate(c.get('broll', [])):
        t0 = word_time(c, b['at']) + b.get('lead', 0); dur = b['dur']; t1 = t0 + dur
        b['_t0'] = t0
        x, y, cw, ch = b['crop']; scale = b.get('width', 1000) / cw
        w2, h2 = int(cw * scale) // 2 * 2, int(ch * scale) // 2 * 2
        mp, sp, bp, pad = card_assets(c, j, w2, h2)
        speed = (b['to'] - b['from']) / dur
        mi, si, bi, gi = n_in, n_in + 1, n_in + 2, n_in + 3; n_in += 4
        ins += ['-loop', '1', '-i', mp, '-loop', '1', '-i', sp, '-loop', '1', '-i', bp, '-loop', '1', '-i', backdrop(c)]
        cy = b.get('cy', 780)
        fc.append(f"[{scr_i}:v]trim=start={b['from']}:end={b['to']},setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS}[bc{j}]")
        fc.append(f"[{gi}:v]format=yuv420p,fps={FPS},trim=duration={dur:.3f}[bg{j}]")
        fc.append(f"[{bi}:v]format=rgba,trim=duration={dur:.3f}[bd{j}]")
        fc.append(f"[bc{j}]crop={cw}:{ch}:{x}:{y},scale={w2}:{h2}:flags=lanczos,format=rgba[cr{j}]")
        fc.append(f"[{mi}:v]format=gray,trim=duration={dur:.3f}[mk{j}]")
        fc.append(f"[cr{j}][mk{j}]alphamerge[ca{j}]")
        fc.append(f"[{si}:v]format=rgba,trim=duration={dur:.3f}[sh{j}]")
        fc.append(f"[bg{j}][sh{j}]overlay={(W - w2) // 2 - pad}:{cy - h2 // 2 - pad + 0}[b1{j}]")
        fc.append(f"[b1{j}][ca{j}]overlay={(W - w2) // 2}:{cy - h2 // 2}[b2{j}]")
        fc.append(f"[b2{j}][bd{j}]overlay={(W - w2) // 2}:{cy - h2 // 2},trim=duration={dur:.3f},setpts=PTS-STARTPTS+{t0:.3f}/TB[br{j}]")
        fc.append(f"[{last}][br{j}]overlay=enable='between(t,{t0:.3f},{t1:.3f})':eof_action=pass[v_{j + 1}]")
        last = f'v_{j + 1}'
    fc.append(f'[{last}]format=yuv420p[vo]')
    fc.append(f'[ac]apad=pad_dur={T}[ao]')
    run([FF, '-y', '-v', 'error', *ins, '-filter_complex', ';'.join(fc), '-map', '[vo]', '-map', '[ao]',
         '-t', f'{D + T:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', *TAGS,
         '-c:a', 'pcm_s16le', '-ar', str(SR), p(c, '.base.mov')])
    json.dump([{k: v for k, v in b.items()} for b in c.get('broll', [])], open(p(c, '.broll.json'), 'w'), indent=1)
    print(f'base: {D:.2f}s + {T}s tail, {len(c.get("broll", []))} b-roll cards')

# ------------------------------------------------------------------ words on the edited timeline
_words_cache = {}
def edited_words(c):
    if 'w' in _words_cache: return _words_cache['w']
    E = edl(c); out = []
    for k in E['keeps']:
        ws = json.load(open(os.path.join(HERE, c['words'][k['src']])))
        for s, e, w, _ in ws:
            if e - s < 0.05: e = s + 0.12
            ov = min(e, k['e']) - max(s, k['s'])
            if ov <= 0 or ov < min(0.12, 0.5 * (e - s)): continue
            t0 = k['off'] + max(s, k['s']) - k['s']; t1 = k['off'] + min(e, k['e']) - k['s']
            w = c.get('fix', {}).get(norm(w), w)
            if w: out.append([round(t0, 3), round(t1, 3), w])
    out.sort(key=lambda x: x[0]); _words_cache['w'] = out; return out

def word_time(c, spec):
    """'word' or 'word#n' -> edited time of its start"""
    w, _, n = spec.partition('#'); n = int(n or 1)
    hits = [x[0] for x in edited_words(c) if norm(x[2]) == norm(w)]
    if len(hits) < n: raise SystemExit(f'anchor word not found: {spec}')
    return hits[n - 1]

def stage_data(c):
    E = edl(c); words = edited_words(c)
    chunks, i = [], 0
    for line in c['lines']:
        want, cur = [norm(x) for x in line.split()], []
        for tok in want:
            j = i
            while j < len(words) and norm(words[j][2]) != tok: j += 1
            if j == len(words): raise SystemExit(f'caption word not found: {tok!r} in {line!r} (after {words[i - 1] if i else None})')
            cur.append(words[j]); i = j + 1
        chunks.append(cur)
    C = []
    for k, ch in enumerate(chunks):
        nxt = chunks[k + 1][0][0] if k + 1 < len(chunks) else E['dur'] + 0.1
        em = set(c.get('emphasis', []))
        C.append({'t0': max(0, ch[0][0] - 0.06), 't1': min(nxt, ch[-1][1] + 0.4),
                  'w': [{'t0': a, 't1': b, 'x': x, 'em': norm(x) in em} for a, b, x in ch]})
    tags = [dict(t, t0=word_time(c, t['at']) - 0.05, t1=word_time(c, t['until']) if 'until' in t else E['dur']) for t in c.get('tags', [])]
    chips = [dict(x, t=word_time(c, x['at'])) for x in c.get('chips', [])]
    labels = []
    for b in c.get('broll', []):
        t0 = word_time(c, b['at']) + b.get('lead', 0)
        if b.get('label'):
            hh = b['crop'][3] * b.get('width', 1000) / b['crop'][2]
            labels.append({'t0': t0, 't1': t0 + b['dur'], 'text': b['label'], 'top': int(b.get('cy', 780) - hh / 2 - 66)})
    lower = c.get('lower_third')
    if lower: lower = dict(lower, t0=word_time(c, lower['at']) - 0.05); lower['t1'] = lower['t0'] + lower['dur']
    data = {'dur': E['dur'] + c['tail'], 'speech': E['dur'], 'chunks': C, 'lower': lower, 'tags': tags, 'chips': chips,
            'labels': labels, 'end': dict(c['end_card'], t0=E['dur'] + 0.15), 'words': words,
            'cuts_in': [[k['off'], k['z']] for a, k in zip(E['keeps'], E['keeps'][1:]) if k['z'] > a['z']],
            'broll_t': [word_time(c, b['at']) + b.get('lead', 0) for b in c.get('broll', [])],
            'cap_top': c.get('cap_top', 1150), 'chips_hold': c.get('chips_hold', 2.2)}
    open(p(c, '.data.js'), 'w').write('window.EDIT = ' + json.dumps(data) + ';\n')
    print(f'data: {len(words)} words, {len(C)} caption lines, {len(tags)} tags, {len(chips)} chips, {len(labels)} labels')

def stage_overlay(c):
    run(['node', os.path.join(HERE, 'render_overlay.mjs'), p(c, '.data.js'), p(c, '_ov')], cwd=HERE)

# ------------------------------------------------------------------ audio
def stage_audio(c):
    data = json.loads(open(p(c, '.data.js')).read().split('=', 1)[1].rstrip(';\n'))
    D = data['speech']; T = c['tail']; N = int((D + T) * SR)
    voice = decode(p(c, '.base.mov'), ['-af', 'highpass=f=80,afftdn=nr=10:nf=-44,equalizer=f=250:t=q:w=1:g=-2,'
                                         'equalizer=f=3200:t=q:w=1.2:g=2,equalizer=f=9500:t=q:w=1:g=1,'
                                         'acompressor=threshold=-22dB:ratio=3:attack=8:release=140:makeup=3'])[:N, 0]
    voice = np.pad(voice, (0, max(0, N - len(voice))))
    k = int(.08 * SR); env = np.convolve(np.abs(voice), np.ones(k) / k, 'same')
    speech = env > np.percentile(env, 60) * 0.5
    v_rms = np.sqrt(np.mean(voice[speech] ** 2))
    m = c['music']; mus = decode(os.path.join(SFX, m['track'] + '.mp3'), ch=2)[int(m.get('offset', 0) * SR):][:N]
    mus = np.pad(mus, ((0, max(0, N - len(mus))), (0, 0)))
    mus *= v_rms * 10 ** (m['level_db'] / 20) / (np.sqrt(np.mean(mus ** 2)) + 1e-9)
    tt = np.arange(N) / SR
    duck = np.convolve(speech.astype(float), np.ones(int(.3 * SR)) / int(.3 * SR), 'same')
    g = (1 - 0.45 * duck) * np.clip(tt / 0.8, 0, 1) * np.where(tt > D, 1.8, 1.0) * np.clip((D + T - tt) / 1.2, 0, 1)
    mix = mus * g[:, None] + voice[:, None]
    def sfx(name, t, lvl, keep=None, align='hit'):
        a = decode(os.path.join(SFX, name + '.mp3'), ch=2); pk = np.abs(a).max()
        hit = 0.0 if align == 'start' else np.argmax(np.abs(a).max(axis=1) > 0.5 * pk) / SR
        if keep:
            a = a[: int((hit + keep) * SR)].copy(); f = min(len(a), int(.12 * SR)); a[-f:] *= np.linspace(1, 0, f)[:, None]
        i0 = int((t - hit) * SR); a = a * lvl / pk
        if i0 < 0: a, i0 = a[-i0:], 0
        n = min(len(a), N - i0)
        if n > 0: mix[i0:i0 + n] += a[:n]
    for s in c.get('sfx', []):
        ev = s.get('event')
        if ev == 'cut_in': ts = [t for t, z in data['cuts_in'] if z >= s.get('min_zoom', 0)]
        elif ev == 'broll': ts = data['broll_t']
        elif ev == 'lower': ts = [data['lower']['t0']] if data.get('lower') else []
        elif ev == 'tags': ts = [t['t0'] for t in data['tags']]
        elif ev == 'chips': ts = [x['t'] for x in data['chips']]
        elif ev == 'end': ts = [data['end']['t0']]
        else: ts = [word_time(c, s['word'])]
        for t in ts: sfx(s['file'], t + s.get('offset', 0), s['level'], s.get('len'), s.get('align', 'hit'))
    path = p(c, '.mix.wav')
    run([FF, '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path], input=mix.astype(np.float32).tobytes())
    meas = run([FF, '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(meas[meas.rindex('I:'):].split()[1]); gain = -14 - I
    run([FF, '-y', '-v', 'quiet', '-i', path, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.84:attack=4:release=60:level=disabled', p(c, '.master.wav')])
    print(f'audio: {I:.1f} LUFS -> {gain:+.1f} dB')

def stage_final(c):
    out = os.path.join(c['out'], c['name'] + '.mp4'); share = os.path.join(c['out'], c['name'] + '_share.mp4')
    run([FF, '-y', '-v', 'error', '-i', p(c, '.base.mov'), '-framerate', str(FPS), '-i', os.path.join(p(c, '_ov'), 'f_%05d.png'),
         '-i', p(c, '.master.wav'), '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
         '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', *TAGS,
         '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out])
    run([FF, '-y', '-v', 'error', '-i', out, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '4.5M', '-maxrate', '6M', '-bufsize', '9M',
         *TAGS, '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', share])
    for f in (out, share): print(f'final: {f}  {os.path.getsize(f) / 1e6:.1f} MB')

STAGES = {'edl': stage_edl, 'base': stage_base, 'data': stage_data, 'overlay': stage_overlay, 'audio': stage_audio, 'final': stage_final}
if __name__ == '__main__':
    c = load(sys.argv[1])
    todo = [sys.argv[sys.argv.index('--stage') + 1]] if '--stage' in sys.argv else list(STAGES)
    for s in todo: STAGES[s](c)
