"""Fast vertical cut for a moody b-roll reel: sped-up shots, hard cuts, one grade, one text card.
No music (added on Instagram), no graphics.

    python3 fast_cut.py projects/building-20s.json   -> out/<name>.mp4

Each shot: source in/out (s), speed factor, and the horizontal centre of the 9:16 crop
(0-1 across the landscape frame).
"""
import os, sys, json, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30

def run(args): subprocess.run([FF, '-v', 'error', '-y', *args], check=True)

def text_card(lines, path, top):
    """White text, soft shadow, centred, on a transparent 1080x1920 layer."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = top
    for txt, font, size, gap in lines:
        f = ImageFont.truetype(os.path.join(HERE, 'fonts', font), size)
        words, rows, cur = txt.split(), [], ''
        for w in words:                                   # wrap inside the middle 80%
            t = (cur + ' ' + w).strip()
            if f.getlength(t) > W * .8 and cur: rows.append(cur); cur = w
            else: cur = t
        rows.append(cur)
        for r in rows:
            x = (W - f.getlength(r)) / 2
            sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(sh).text((x, y + 3), r, font=f, fill=(0, 0, 0, 170))
            img = Image.alpha_composite(img, sh.filter(ImageFilter.GaussianBlur(6)))
            ImageDraw.Draw(img).text((x, y), r, font=f, fill=(255, 255, 255, 255))
            y += int(size * 1.22)
        y += gap
    img.save(path)

def main():
    cfg = json.load(open(sys.argv[1]))
    name = cfg['name']; src = os.path.join(HERE, cfg['source'])
    work = os.path.join(HERE, 'work', name); os.makedirs(work, exist_ok=True)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    sw, sh = cfg['source_size']
    cw = round(sh * 9 / 16 / 2) * 2
    grade = cfg['grade']
    parts = []
    for k, s in enumerate(cfg['shots']):
        x0 = int(min(max(s['cx'] * sw - cw / 2, 0), sw - cw))
        out = os.path.join(work, f'shot{k:02d}.mp4'); parts.append(out)
        vf = (f"setpts=PTS/{s['speed']},fps={FPS},crop={cw}:{sh}:{x0}:0,scale={W}:{H}:flags=lanczos,format=yuv420p10le,"
              f"colorspace=all=bt709:iall=bt2020:itrc=bt709:fast=1,{grade},format=yuv420p")
        run(['-ss', str(s['in']), '-t', str(s['out'] - s['in']), '-i', src, '-an', '-vf', vf,
             '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out])
        print(f'shot {k}: {s["in"]}-{s["out"]} x{s["speed"]} -> {(s["out"] - s["in"]) / s["speed"]:.2f}s')
    lst = os.path.join(work, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    joined = os.path.join(work, 'joined.mp4')
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', joined])

    t = cfg['text']
    l1, l2 = os.path.join(work, 'text1.png'), os.path.join(work, 'text2.png')
    text_card([(t['line1'], 'Inter-700.ttf', 62, 18)], l1, t['top'])
    # line 2 is drawn with line 1 above it so the two layers line up exactly
    text_card([(t['line1'], 'Inter-700.ttf', 62, 18), (t['line2'], 'Inter-500.ttf', 50, 0)], l2, t['top'])
    a, b = t['in1'], t['in2']
    fc = (f"[1:v]format=rgba,fade=t=in:st={a}:d=0.3:alpha=1[t1];[2:v]format=rgba,fade=t=in:st={b}:d=0.3:alpha=1[t2];"
          f"[0:v][t1]overlay=enable='lt(t,{b + .3})'[v1];[v1][t2]overlay=enable='gte(t,{b})'[v]")
    final = os.path.join(HERE, 'out', f'{name}.mp4')
    dur = sum((s['out'] - s['in']) / s['speed'] for s in cfg['shots'])
    run(['-i', joined, '-loop', '1', '-i', l1, '-loop', '1', '-i', l2, '-filter_complex', fc, '-map', '[v]', '-t', f'{dur:.3f}',
         '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
         '-colorspace', 'bt709', '-movflags', '+faststart', final])
    print('->', final)

if __name__ == '__main__':
    main()
