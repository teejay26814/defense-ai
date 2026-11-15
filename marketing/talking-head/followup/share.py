"""Phone-sized HDR copies (~28 MB) of the masters: two-pass x265 at a fixed bitrate."""
import os, sys, subprocess, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'out/followup'); os.chdir(os.path.join(HERE, 'work/followup'))
P = ['-c:v', 'libx265', '-preset', 'slow', '-b:v', '4700k', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p10le',
     '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc']
XP = 'colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited:log-level=error'
pic = 'picture.mp4'
subprocess.run([FF, '-v', 'error', '-y', '-i', pic, *P, '-x265-params', XP + ':pass=1', '-an', '-f', 'null', '/dev/null'], check=True)
subprocess.run([FF, '-v', 'error', '-y', '-i', pic, *P, '-x265-params', XP + ':pass=2', '-an', 'picture_share.mp4'], check=True)
for name, mix in [('final_share.mp4', 'mix_music.wav'), ('final-no-music_share.mp4', 'mix_nomusic.wav')]:
    subprocess.run([FF, '-v', 'error', '-y', '-i', 'picture_share.mp4', '-i', mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
                    '-shortest', '-movflags', '+faststart', os.path.join(OUT, name)], check=True)
print('SHAREDONE')
