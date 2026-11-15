"""Talking-head reel template: cut, grade, punch-in zooms, branded captions, lower third,
end card, voice clean-up, music bed.  One JSON per video in projects/.

    python3 edit.py projects/intro-01.json            -> out/intro-01.mp4 (+ out/intro-01_share.mp4)
    python3 edit.py projects/intro-01.json --stage base|data|overlay|audio|final

Pipeline
  base    ffmpeg: iPhone HLG -> SDR (bt709 gamut, curve kept), brand grade, keep-segments with
          alternating punch-in zoom (jump cuts), frozen + blurred tail for the end card
  data    word timings (Whisper, projects' words file) mapped onto the edited timeline ->
          caption chunks, lower third and end card timings -> work/<name>.data.js
  overlay overlay.html rendered to transparent PNG frames (render_overlay.mjs)
  audio   voice chain (HPF, denoise, EQ, compression) + music bed ducked under speech + SFX,
          one static gain to -14 LUFS, -1 dBTP limiter
  final   composite overlay onto base, mux audio
"""
import json, os, re, subprocess, sys
import numpy as np
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, '..', 'motion-busywork', 'sfx')
W, H, FPS, SR = 1080, 1920, 30, 48000

# iPhone HLG is designed to look right on SDR screens: convert the gamut only, keep the curve.
TO_SDR = 'colorspace=all=bt709:iall=bt2020:itrc=bt709:format=yuv420p'
# Grade: warm "creator glow" matched to a reference the client liked - peachy warmth, lifted
# soft shadows, richer skin (reds/oranges up, curtain yellows down), gentle luma-only glow.
GRADE = ("colortemperature=temperature=5000:mix=0.7,eq=saturation=1.1:gamma=1.04,"
         "huesaturation=saturation=-0.15:colors=y:strength=1,"
         "huesaturation=saturation=0.14:colors=r:strength=1,"
         "colorbalance=rh=0.02:bh=-0.02,"
         "curves=master='0/0.09 0.25/0.27 0.5/0.52 0.8/0.79 1/0.95',"
         "split[ga][gb];[gb]gblur=sigma=30[gg];[ga][gg]blend=c0_mode=screen:c0_opacity=0.18:c1_opacity=0:c2_opacity=0,"
         "vignette=angle=PI/6")

# tag outputs as plain Rec.709 so every phone decodes the colours the same way
TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']

def run(cmd, **kw): return subprocess.run(cmd, check=True, **kw)

def load_cfg(path):
    cfg = json.load(open(path)); cfg['_dir'] = HERE
    cfg['work'] = os.path.join(HERE, 'work'); cfg['out'] = os.path.join(HERE, 'out')
    os.makedirs(cfg['work'], exist_ok=True); os.makedirs(cfg['out'], exist_ok=True)
    cfg['edit_dur'] = sum(e - s for s, e, _ in cfg['keeps'])
    return cfg

def p(cfg, suffix): return os.path.join(cfg['work'], f"{cfg['name']}{suffix}")

# ---------------------------------------------------------------- base
def stage_base(cfg):
    ks = cfg['keeps']; n = len(ks); D = cfg['edit_dur']; T = cfg['tail']
    fc = [f"[0:v]{TO_SDR},{GRADE},split={n}" + ''.join(f'[s{i}]' for i in range(n)),
          f"[0:a]asplit={n}" + ''.join(f'[r{i}]' for i in range(n))]
    for i, (s, e, z) in enumerate(ks):
        zw, zh = int(W * z) // 2 * 2, int(H * z) // 2 * 2
        # crop anchored high so the face stays in frame when punching in
        fc.append(f"[s{i}]trim=start={s}:end={e},setpts=PTS-STARTPTS,scale={zw}:{zh}:flags=lanczos,"
                  f"crop={W}:{H}:{(zw - W) // 2}:{int((zh - H) * 0.3)},setsar=1[v{i}]")
        d = e - s
        fc.append(f"[r{i}]atrim=start={s}:end={e},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={d - 0.03:.3f}:d=0.03[a{i}]")
    fc.append(''.join(f'[v{i}][a{i}]' for i in range(n)) + f"concat=n={n}:v=1:a=1[vc][ac]")
    fc.append(f"[vc]fps={FPS},tpad=stop_mode=clone:stop_duration={T},"
              f"boxblur=luma_radius=22:luma_power=2:enable='gte(t,{D + 0.1:.3f})',fade=t=in:d=0.25[vo]")
    fc.append(f"[ac]apad=pad_dur={T}[ao]")
    run([FF, '-y', '-v', 'error', '-i', os.path.join(HERE, cfg['src']), '-filter_complex', ';'.join(fc),
         '-map', '[vo]', '-map', '[ao]', '-t', f'{D + T:.3f}', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', *TAGS,
         '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-ar', str(SR), p(cfg, '.base.mov')])
    print(f'base: {D:.2f}s of speech + {T}s tail')

# ---------------------------------------------------------------- data
def norm(w): return re.sub(r"[^a-z0-9']", '', w.lower())

def stage_data(cfg):
    words = json.load(open(os.path.join(HERE, cfg['words'])))
    offs, acc = [], 0.0
    for s, e, _ in cfg['keeps']: offs.append(acc); acc += e - s
    fix = {k.lower(): v for k, v in cfg.get('fix', {}).items()}
    out = []
    for s, e, w, _ in words:
        best = None
        for (ks, ke, _), off in zip(cfg['keeps'], offs):
            ov = min(e, ke) - max(s, ks)
            if ov > 0 and (best is None or ov > best[0]): best = (ov, ks, ke, off)
        if e - s < 0.05:                                # zero-length word from the recogniser: keep if inside a segment
            for (ks, ke, _), off in zip(cfg['keeps'], offs):
                if ks <= s <= ke: best = (1, ks, ke, off)
        if not best or best[0] < min(0.15, 0.5 * (e - s)): continue
        _, ks, ke, off = best
        t0, t1 = off + max(s, ks) - ks, off + min(e, ke) - ks
        key = norm(w)
        if key in fix:
            w = fix[key]
            if not w:                                   # dropped word: give its time to the previous one
                if out: out[-1][1] = t1
                continue
        out.append([round(t0, 3), round(t1, 3), w, norm(w) in cfg.get('emphasis', [])])
    for i in range(1, len(out)):                        # zero-length words borrow time from their neighbour
        if out[i][1] - out[i][0] < 0.05:
            mid = (out[i - 1][0] + out[i][1]) / 2; out[i - 1][1] = out[i][0] = round(mid, 3)
    chunks = []
    if cfg.get('lines'):   # hand-set caption lines (sentence-aware); unmatched words (fillers) are skipped
        i = 0
        for line in cfg['lines']:
            want, cur = [norm(x) for x in line.split()], []
            for tok in want:
                j = i
                while j < len(out) and norm(out[j][2]) != tok: j += 1
                if j == len(out): raise SystemExit(f'caption word not found: {tok!r} in {line!r}')
                cur.append(out[j]); i = j + 1
            chunks.append(cur)
    else:                  # automatic: up to 3 words / 18 characters, break on pauses
        cur = []
        for wd in out:
            txt = ' '.join(x[2] for x in cur + [wd])
            if cur and (len(cur) == 3 or len(txt) > 18 or wd[0] - cur[-1][1] > 0.35):
                chunks.append(cur); cur = []
            cur.append(wd)
        if cur: chunks.append(cur)
    C = []
    for i, ch in enumerate(chunks):
        nxt = chunks[i + 1][0][0] if i + 1 < len(chunks) else cfg['edit_dur'] + 0.1
        C.append({'t0': max(0, ch[0][0] - 0.06), 't1': min(nxt, ch[-1][1] + 0.45),
                  'w': [{'t0': a, 't1': b, 'x': x, 'em': em} for a, b, x, em in ch]})
    lt = cfg.get('lower_third')
    if lt:   # appears on the first word after "<after_word>" nearest the given source time
        src_t = lt['near']
        # map near-time onto the edited timeline
        for (ks, ke, _), off in zip(cfg['keeps'], offs):
            if ks <= src_t <= ke: et = off + src_t - ks; break
        else: et = 0
        lt = dict(lt, t0=round(et - 0.05, 3), t1=round(et - 0.05 + lt['dur'], 3))
    cuts, prev = [], None
    for (ks, ke, z), off in zip(cfg['keeps'], offs):
        if prev is not None and z > prev: cuts.append((round(off, 3), z))   # punch-in cuts
        prev = z
    data = {'dur': cfg['edit_dur'] + cfg['tail'], 'speech': cfg['edit_dur'], 'chunks': C, 'lower': lt,
            'words': [[a, b, x] for a, b, x, _ in out], 'cuts_in': cuts,
            'end': dict(cfg['end_card'], t0=cfg['edit_dur'] + 0.15)}
    open(p(cfg, '.data.js'), 'w').write('window.EDIT = ' + json.dumps(data, indent=1) + ';\n')
    print(f'data: {len(out)} words, {len(C)} caption chunks')
    for c in C: print(f"  {c['t0']:6.2f}-{c['t1']:6.2f}  " + ' '.join(w['x'] for w in c['w']))

# ---------------------------------------------------------------- overlay
def stage_overlay(cfg):
    run(['node', os.path.join(HERE, 'render_overlay.mjs'), p(cfg, '.data.js'), p(cfg, '_ov')], cwd=HERE)

# ---------------------------------------------------------------- audio
def decode(path, extra=(), ch=1):
    raw = run([FF, '-v', 'quiet', '-i', path, *extra, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()

def stage_audio(cfg):
    D, T = cfg['edit_dur'], cfg['tail']; N = int((D + T) * SR)
    voice = decode(p(cfg, '.base.mov'), ['-af', 'highpass=f=80,afftdn=nr=12:nf=-42,equalizer=f=300:t=q:w=1:g=-2.5,'
                                           'equalizer=f=3500:t=q:w=1.2:g=2.5,equalizer=f=9000:t=q:w=1:g=1,'
                                           'acompressor=threshold=-22dB:ratio=3:attack=8:release=140:makeup=3'])[:N, 0]
    voice = np.pad(voice, (0, max(0, N - len(voice))))
    env = np.convolve(np.abs(voice), np.ones(int(.08 * SR)) / int(.08 * SR), 'same')
    speech = env > np.percentile(env, 60) * 0.5
    v_rms = np.sqrt(np.mean(voice[speech] ** 2))
    m = cfg['music']
    mus = decode(os.path.join(SFX, m['track'] + '.mp3'), ch=2)[int(m.get('offset', 0) * SR):][:N]
    mus = np.pad(mus, ((0, max(0, N - len(mus))), (0, 0)))
    mus *= v_rms * 10 ** (m['level_db'] / 20) / (np.sqrt(np.mean(mus ** 2)) + 1e-9)
    tt = np.arange(N) / SR
    duck = np.convolve(speech.astype(float), np.ones(int(.3 * SR)) / int(.3 * SR), 'same')
    g = (1 - 0.45 * duck)                                           # dip ~5 dB while talking
    g *= np.clip(tt / 0.8, 0, 1)
    g *= np.where(tt > D, 1.8, 1.0)                                 # the bed comes up under the end card
    g *= np.clip((D + T - tt) / 1.2, 0, 1)                          # and fades out
    mix = mus * g[:, None] + voice[:, None]
    def sfx(name, t, lvl, keep=None, align='hit'):
        a = decode(os.path.join(SFX, name + '.mp3'), ch=2); pk = np.abs(a).max()
        hit = 0.0 if align == 'start' else np.argmax(np.abs(a).max(axis=1) > 0.5 * pk) / SR
        if keep:                                    # trim after the hit, with a short fade
            a = a[: int((hit + keep) * SR)].copy(); f = min(len(a), int(.12 * SR)); a[-f:] *= np.linspace(1, 0, f)[:, None]
        i0 = int((t - hit) * SR); a = a * lvl / pk
        if i0 < 0: a, i0 = a[-i0:], 0
        n = min(len(a), N - i0); mix[i0:i0 + n] += a[:n]
    data = json.loads(open(p(cfg, '.data.js')).read().split('=', 1)[1].rstrip(';\n'))
    # sound design: every cue is anchored to an event or a spoken word, never to a raw timestamp
    for c in cfg.get('sfx', []):
        if c.get('event') == 'cut_in': ts = [t for t, z in data['cuts_in'] if z >= c.get('min_zoom', 0)]
        elif c.get('event') == 'lower': ts = [data['lower']['t0']] if data.get('lower') else []
        elif c.get('event') == 'end': ts = [data['end']['t0']]
        elif c.get('event') == 'start': ts = [0.0]
        else:
            hits = [w[0] for w in data['words'] if norm(w[2]) == norm(c['word'])]
            ts = [hits[c.get('occ', 1) - 1]] if len(hits) >= c.get('occ', 1) else []
        for t in ts: sfx(c['file'], t + c.get('offset', 0), c['level'], c.get('len'), c.get('align', 'hit'))
    path = p(cfg, '.mix.wav')
    run([FF, '-y', '-v', 'quiet', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', path], input=mix.astype(np.float32).tobytes())
    meas = run([FF, '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float(meas[meas.rindex('I:'):].split()[1]); gain = -14 - I
    run([FF, '-y', '-v', 'quiet', '-i', path, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.84:attack=4:release=60:level=disabled',
         p(cfg, '.master.wav')])
    print(f'audio: {I:.1f} LUFS -> {gain:+.1f} dB')

# ---------------------------------------------------------------- final
def stage_final(cfg):
    out = os.path.join(cfg['out'], cfg['name'] + '.mp4')
    run([FF, '-y', '-v', 'error', '-i', p(cfg, '.base.mov'), '-framerate', str(FPS), '-i', os.path.join(p(cfg, '_ov'), 'f_%05d.png'),
         '-i', p(cfg, '.master.wav'), '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]',
         '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', *TAGS,
         '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out])
    share = os.path.join(cfg['out'], cfg['name'] + '_share.mp4')
    run([FF, '-y', '-v', 'error', '-i', out, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '5M', '-maxrate', '6.5M', '-bufsize', '10M', *TAGS,
         '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', share])
    for f in (out, share): print(f'final: {f}  {os.path.getsize(f) / 1e6:.1f} MB')

STAGES = {'base': stage_base, 'data': stage_data, 'overlay': stage_overlay, 'audio': stage_audio, 'final': stage_final}
if __name__ == '__main__':
    cfg = load_cfg(sys.argv[1])
    todo = [sys.argv[sys.argv.index('--stage') + 1]] if '--stage' in sys.argv else list(STAGES)
    for s in todo: STAGES[s](cfg)
