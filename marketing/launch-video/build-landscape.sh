#!/bin/bash
set -e
cd "$(dirname "$0")"
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
SCALE=1.5 node render.mjs composition.html launch-landscape.mp4 1280 720
echo "=== compat ==="
"$FF" -y -i launch-landscape.mp4 -f lavfi -i anullsrc=r=44100:cl=stereo -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -crf 20 -preset medium -c:a aac -b:a 96k -shortest -movflags +faststart launch-landscape_compat.mp4
echo "=== gif ==="
"$FF" -y -i launch-landscape.mp4 -vf "fps=10,scale=720:-1:flags=lanczos,palettegen" /tmp/pal.png
"$FF" -y -i launch-landscape.mp4 -i /tmp/pal.png -lavfi "fps=10,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse" launch-landscape_preview.gif
echo "BUILD DONE"
