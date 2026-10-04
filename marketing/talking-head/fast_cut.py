"""Fast cut for a moody b-roll reel: sped-up shots, hard cuts, one light grade, text, an end CTA.
No music (added on Instagram), no graphics.

    python3 fast_cut.py projects/building-20s.json   -> out/<name>.mp4

Each shot: source in/out (s), speed factor, and the horizontal centre of the crop
(0-1 across the landscape frame). "aspect" sets the crop shape (4:5 keeps head and screen
together; 9:16 is too narrow for that).

"hdr": true keeps the iPhone's HLG HDR end to end (10-bit HEVC, BT.2020/HLG tags), so the
edit looks as bright and clean on the phone as the original clip. Converting HLG to SDR is
what made the earlier exports look flat and soft next to the source.
"""
import os, sys, json, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30

def run(args): subprocess.run([FF, '-v', 'error', '-y', *args], check=True)

def text_card(blocks, path, W, H, top, white):
    """Centred text with a soft shadow on a transparent layer. In HLG, diffuse white sits at
    ~75% signal; full 255 would render as a glaring highlight, so 'white' is set per mode."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = top
    for txt, font, size, gap in blocks:
        f = ImageFont.truetype(os.path.join(HERE, 'fonts', font), size)
        rows, cur = [], ''
        for w in txt.split():                                   # wrap inside the middle 80%
            t = (cur + ' ' + w).strip()
            if f.getlength(t) > W * .8 and cur: rows.append(cur); cur = w
            else: cur = t
        rows.append(cur)
        for r in rows:
            x = (W - f.getlength(r)) / 2
            sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(sh).text((x, y + 3), r, font=f, fill=(0, 0, 0, 160))
            img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(7)))
            ImageDraw.Draw(img).text((x, y), r, font=f, fill=(white, white, white, 255))
            y += int(size * 1.22)
        y += gap
    img.save(path)

def main():
    cfg = json.load(open(sys.argv[1]))
    name = cfg['name']; src = os.path.join(HERE, cfg['source'])
    work = os.path.join(HERE, 'work', name); os.makedirs(work, exist_ok=True)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    sw, sh = cfg['source_size']; aw, ah = cfg.get('aspect', [9, 16]); W, H = cfg.get('out_size', [1080, 1920])
    hdr = cfg.get('hdr', False)
    cw = round(sh * aw / ah / 2) * 2
    if hdr:
        pix, tags = 'yuv420p10le', ['-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc']
        enc = lambda crf: ['-c:v', 'libx265', '-crf', str(crf), '-preset', 'slow', '-tag:v', 'hvc1',
                           '-x265-params', 'log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited']
        convert = ''
    else:
        pix, tags = 'yuv420p', ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709']
        enc = lambda crf: ['-c:v', 'libx264', '-crf', str(crf), '-preset', 'slow']
        convert = 'colorspace=all=bt709:iall=bt2020:itrc=bt709:fast=1,'
    grade = cfg.get('grade', 'null')

    parts, durs = [], []
    for k, s in enumerate(cfg['shots']):
        x0 = int(min(max(s['cx'] * sw - cw / 2, 0), sw - cw))
        out = os.path.join(work, f'shot{k:02d}.mov'); parts.append(out)
        sp = s['speed']
        # blend frames on fast shots so they read as smooth motion blur rather than stutter
        blend = f"tmix=frames={min(int(sp), 4)}," if sp >= 3 else ''
        vf = (f"format=yuv420p10le,crop={cw}:{sh}:{x0}:0,scale={W}:{H}:flags=lanczos,{blend}setpts=PTS/{sp},fps={FPS},"
              f"{convert}{grade},format={pix}")
        run(['-ss', str(s['in']), '-t', str(s['out'] - s['in']), '-i', src, '-an', '-vf', vf, *enc(12), *tags, out])
        durs.append((s['out'] - s['in']) / sp)
        print(f'shot {k}: {s["in"]}-{s["out"]} x{sp} -> {durs[-1]:.2f}s')
    lst = os.path.join(work, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    joined = os.path.join(work, 'joined.mov')
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', joined])

    t = cfg['text']; white = 191 if hdr else 255
    s1, s2 = t.get('size1', 58), t.get('size2', 46)
    l1, l2, l3 = (os.path.join(work, f'text{i}.png') for i in (1, 2, 3))
    text_card([(t['line1'], 'Inter-700.ttf', s1, 16)], l1, W, H, t['top'], white)
    text_card([(t['line1'], 'Inter-700.ttf', s1, 16), (t['line2'], 'Inter-500.ttf', s2, 0)], l2, W, H, t['top'], white)
    text_card([(t['cta'], 'Inter-700.ttf', s1, 0)], l3, W, H, t['top'] + int(s1 * .6), white)
    dur = sum(durs)
    a, b = t['in1'], t['in2']
    c = dur - durs[-1] + .15 if t.get('cta_at') is None else t['cta_at']        # CTA lands on the last shot
    fc = (f"[1:v]format=rgba,fade=t=in:st={a}:d=0.3:alpha=1[t1];"
          f"[2:v]format=rgba,fade=t=in:st={b}:d=0.3:alpha=1,fade=t=out:st={c - .25}:d=0.25:alpha=1[t2];"
          f"[3:v]format=rgba,fade=t=in:st={c}:d=0.35:alpha=1[t3];"
          f"[0:v][t1]overlay=enable='lt(t,{b + .3})':format=yuv420p10[v1];[v1][t2]overlay=enable='between(t,{b},{c})':format=yuv420p10[v2];"
          f"[v2][t3]overlay=enable='gte(t,{c})':format=yuv420p10,format={pix}[v]")
    final = os.path.join(HERE, 'out', f'{name}.mp4')
    run(['-i', joined, '-loop', '1', '-i', l1, '-loop', '1', '-i', l2, '-loop', '1', '-i', l3, '-filter_complex', fc,
         '-map', '[v]', '-t', f'{dur:.3f}', *enc(11), *tags, '-movflags', '+faststart', final])
    print(f'-> {final}  ({dur:.1f}s, {W}x{H}, {"HDR HLG" if hdr else "SDR"})')

if __name__ == '__main__':
    main()
