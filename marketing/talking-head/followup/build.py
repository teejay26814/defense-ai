"""Assemble the follow-up reel -> out/followup/final.mp4, final-no-music.mp4, cover.jpg

    python3 followup/build.py [--fresh]

Face: frame-exact cuts from both takes (VFR iPhone footage resampled to an exact 30 fps grid and
stopped at the audio's frame count), cropped around the face for each punch-in, graded per take.
Screens: the blurred clips from screens.py, sRGB -> HLG, laid over their beats.
Graphics: overlay PNGs (render_overlay.mjs), sRGB -> HLG. Picture stays 10-bit HLG end to end.
"""
import os, sys, json, subprocess
import numpy as np
from PIL import Image
import imageio_ffmpeg

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(HERE, 'explainer'))
from build import srgb_to_hlg_cube, x265, HDR_TAGS, run    # shared with the explainer pipeline
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1080, 1920, 30
CFG = next((a for a in sys.argv[1:] if a.endswith('.json')), 'followup/followup.json')
_C = json.load(open(os.path.join(HERE, CFG)))
WORK = os.path.join(HERE, 'work', _C['name']); OUT = os.path.join(HERE, 'out', _C['name'])
FACE = {'A': (994, 1805), 'B': (950, 1640)}                 # face centre in each rotated 2160x3840 take
LUT = {'A': 'looks/followup-A.cube', 'B': 'looks/followup-B.cube'}
SCREENS = [tuple(s) for s in _C.get('screens', [('task', 13.933), ('rules', 21.2), ('gmail', 32.933)])]

def main():
    C = _C; E = json.load(open(os.path.join(WORK, 'edl.json')))
    os.makedirs(OUT, exist_ok=True)
    parts = []
    for k, c in enumerate(E['cuts']):
        src = os.path.join(HERE, C['sources'][c['src']]['video']); fx, fy = FACE[c['src']]
        z = c['zoom']; cw, ch = round(2160 / z / 2) * 2, round(3840 / z / 2) * 2
        x0 = int(min(max(fx - cw / 2, 0), 2160 - cw)); y0 = int(min(max(fy - ch * .47, 0), 3840 - ch))
        p = os.path.join(WORK, f'cut{k:02d}.mp4'); parts.append(p)
        if os.path.exists(p) and '--fresh' not in sys.argv: continue
        n = round((c['out'] - c['in']) * FPS)
        lut = os.path.join(HERE, LUT[c['src']])
        vf = (f"fps={FPS}:round=near,crop={cw}:{ch}:{x0}:{y0},scale={W}:{H}:flags=lanczos,format=yuv420p10le,"
              f"scale=in_color_matrix=bt2020:in_range=tv:out_range=pc,format=gbrp16le,lut3d={lut}:interp=tetrahedral,"
              f"scale=out_color_matrix=bt2020:in_range=pc:out_range=tv,format=yuv420p10le")
        run(['-ss', f"{c['in']:.4f}", '-i', src, '-an', '-vf', vf, '-frames:v', str(n), *x265(8, 'fast'), *HDR_TAGS, p])
        print(f"cut {k:2d} {c['src']} {c['in']:7.2f}-{c['out']:7.2f} z{z}")
    lst = os.path.join(WORK, 'cuts.txt'); open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    graded = os.path.join(WORK, 'graded.mp4'); run(['-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', graded])
    if '--cuts-only' in sys.argv: return
    cube = os.path.join(WORK, 'srgb2hlg.cube'); srgb_to_hlg_cube(cube)
    to_hlg = f"lut3d={cube},scale=out_color_matrix=bt2020:out_range=tv"
    ins = ['-i', graded]
    fc = ''; last = '0:v'
    for i, (name, t0) in enumerate(SCREENS, 1):
        ins += ['-i', os.path.join(WORK, f'screen_{name}.mp4')]
        fc += (f"[{i}:v]format=rgb48le,{to_hlg},format=yuv420p10le,setpts=PTS-STARTPTS+{t0}/TB[s{i}];"
               f"[{last}][s{i}]overlay=eof_action=pass:format=yuv420p10[v{i}];")
        last = f'v{i}'
    k = len(SCREENS) + 1
    ins += ['-framerate', str(FPS), '-i', os.path.join(WORK, 'ov', 'f_%05d.png')]
    fc += f"[{k}:v]format=rgba64le,{to_hlg},format=yuva444p10le[o];[{last}][o]overlay=format=yuv444p10:eof_action=pass,format=yuv420p10le[v]"
    picture = os.path.join(WORK, 'picture.mp4')
    run([*ins, '-filter_complex', fc, '-map', '[v]', '-t', f"{E['duration']:.3f}", *x265(16, 'slow'), *HDR_TAGS, picture])
    for name, mix in [('final.mp4', 'mix_music.wav'), ('final-no-music.mp4', 'mix_nomusic.wav')]:
        run(['-i', picture, '-i', os.path.join(WORK, mix), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
             '-ar', '48000', '-shortest', '-movflags', '+faststart', os.path.join(OUT, name)])
        print('->', os.path.join(OUT, name))
    cover(picture, 1.0, os.path.join(OUT, 'cover.jpg'))

def cover(video, t, path):
    """an SDR JPEG from the HLG picture: HLG -> scene light -> BT.709 -> gentle shoulder -> sRGB"""
    raw = subprocess.run([FF, '-v', 'error', '-ss', str(t), '-i', video, '-frames:v', '1', '-vf',
                          'scale=in_color_matrix=bt2020:in_range=tv,format=rgb48le', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    E = np.frombuffer(raw, np.uint16).reshape(H, W, 3) / 65535.
    a, b, c = 0.17883277, 0.28466892, 0.55991073
    L = np.where(E <= .5, E * E / 3, (np.exp((E - c) / a) + b) / 12)
    M = np.array([[1.6605, -.5876, -.0728], [-.1246, 1.1329, -.0083], [-.0182, -.1006, 1.1187]])     # BT.2020 -> BT.709
    L = np.clip(L @ M.T, 0, None) / 0.30                                  # HLG ~80% signal -> SDR white
    L = L / (1 + L / 4)                                                   # soft shoulder for the brightest highlights
    s = np.where(L <= .0031308, 12.92 * L, 1.055 * np.power(np.clip(L, 0, 1), 1 / 2.4) - .055)
    Image.fromarray((np.clip(s, 0, 1) * 255 + .5).astype(np.uint8)).save(path, quality=93)
    print('->', path)

if __name__ == '__main__':
    main()
