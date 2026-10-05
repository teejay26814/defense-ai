"""Assemble the explainer: graded HDR shots + graphics + mix -> out/<name>.mp4

    python3 explainer/build.py explainer/ai-automation-01.json

Picture stays HLG/BT.2020 10-bit from source to export (that keeps the iPhone's look and
quality). Each cut is cropped around the face for its punch-in, scaled to 1080x1920 and graded
through looks/explainer-hlg.cube. The graphics are rendered in sRGB, so they go through an
sRGB -> HLG LUT first (white lands on HLG diffuse white, 75%), then are composited.
"""
import os, sys, json, subprocess
import numpy as np
import imageio_ffmpeg

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1080, 1920
FACE = (842, 1805)                     # face centre in the rotated 2160x3840 source
HDR_TAGS = ['-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc']
def x265(crf, preset): return ['-c:v', 'libx265', '-crf', str(crf), '-preset', preset, '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p10le',
                               '-x265-params', 'log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited']
def run(a): subprocess.run([FF, '-v', 'error', '-y', *a], check=True)

def srgb_to_hlg_cube(path, N=33):
    g = np.linspace(0, 1, N); B_, G_, R_ = np.meshgrid(g, g, g, indexing='ij')
    s = np.stack([R_, G_, B_], -1).reshape(-1, 3)
    lin = np.where(s <= .04045, s / 12.92, ((s + .055) / 1.055) ** 2.4)
    M = np.array([[.6274, .3293, .0433], [.0691, .9195, .0114], [.0164, .0880, .8956]])     # BT.709 -> BT.2020
    L = np.clip(lin @ M.T, 0, 1) * 0.4458     # sRGB white -> HLG 85%: level with the graded wall, so text reads white, not grey
    a, b, c = 0.17883277, 0.28466892, 0.55991073
    E = np.where(L <= 1 / 12, np.sqrt(3 * L), a * np.log(np.maximum(12 * L - b, 1e-9)) + c)
    with open(path, 'w') as f:
        f.write(f'LUT_3D_SIZE {N}\n'); f.writelines(f'{r[0]:.6f} {r[1]:.6f} {r[2]:.6f}\n' for r in E)

def main():
    cfg = json.load(open(sys.argv[1])); name = cfg['name']
    work = os.path.join(HERE, 'work', name); src = os.path.join(HERE, cfg['source'])
    E = json.load(open(os.path.join(work, 'edl.json')))
    lut = os.path.join(HERE, 'looks', 'explainer-hlg.cube')
    grade = (f"scale=in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp16le,lut3d={lut}:interp=tetrahedral,"
             f"scale=out_color_matrix=bt2020:in_range=pc:out_range=tv,format=yuv420p10le")
    parts = []
    for k, c in enumerate(E['cuts']):
        z = c['zoom']; cw, ch = round(2160 / z / 2) * 2, round(3840 / z / 2) * 2
        x0 = int(min(max(FACE[0] - cw / 2, 0), 2160 - cw)); y0 = int(min(max(FACE[1] - ch * .47, 0), 3840 - ch))
        p = os.path.join(work, f'cut{k:02d}.mp4'); parts.append(p)
        if os.path.exists(p) and '--fresh' not in sys.argv: continue
        # The iPhone clip is variable frame rate: resample onto an exact 30 fps grid and stop at exactly the
        # number of frames the audio for this cut lasts. (Trimming by time with -t/-r added 1-2 frames per
        # cut, so the picture drifted ~0.7 s behind the voice by the end.)
        n = round((c['out'] - c['in']) * 30)
        vf = f"fps=30:round=near,crop={cw}:{ch}:{x0}:{y0},scale={W}:{H}:flags=lanczos,format=yuv420p10le,{grade}"
        run(['-ss', f"{c['in']:.4f}", '-i', src, '-an', '-vf', vf, '-frames:v', str(n), *x265(8, 'fast'), *HDR_TAGS, p])
        print(f'cut {k:2d}  {c["in"]:7.2f}-{c["out"]:7.2f}  z{z}')
    lst = os.path.join(work, 'cuts.txt'); open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    graded = os.path.join(work, 'graded.mp4')
    run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', graded])
    cube = os.path.join(work, 'srgb2hlg.cube'); srgb_to_hlg_cube(cube)
    final = os.path.join(HERE, 'out', f'{name}.mp4'); os.makedirs(os.path.dirname(final), exist_ok=True)
    fc = (f"[1:v]format=rgba64le,lut3d={cube},scale=out_color_matrix=bt2020:out_range=tv,format=yuva444p10le[o];"
          f"[0:v][o]overlay=format=yuv444p10:eof_action=pass,format=yuv420p10le[v]")
    run(['-i', graded, '-framerate', '30', '-i', os.path.join(work, 'ov', 'f_%05d.png'), '-i', os.path.join(work, 'mix.wav'),
         '-filter_complex', fc, '-map', '[v]', '-map', '2:a', '-t', f"{E['duration']:.3f}", *x265(14, 'slow'), *HDR_TAGS,
         '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', final])
    print('->', final)

if __name__ == '__main__':
    main()
