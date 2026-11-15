set -e
cd "$(dirname "$0")"
FILM=film2.html DUR=42 DPR=2 Q=95 node render2.js 1920 1080 fr2L 30 > logL.txt 2>&1 &
FILM=film2.html DUR=42 DPR=2 Q=95 node render2.js 1080 1920 fr2P 30 > logP.txt 2>&1 &
wait
ffmpeg -nostdin -v error -y -i audio2/mix.wav -af loudnorm=I=-14:TP=-1.2:LRA=11 -ar 48000 audio2/mix_ln.wav
for o in L P; do
  if [ $o = L ]; then S=1920:1080; N=academia-scribes-launch-grand-16x9.mp4; else S=1080:1920; N=academia-scribes-launch-grand-9x16.mp4; fi
  ffmpeg -nostdin -v error -y -framerate 30 -i fr2$o/%05d.jpg -i audio2/mix_ln.wav -vf "scale=$S:flags=lanczos,unsharp=5:5:0.35" \
    -c:v libx264 -preset slow -crf 15 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 256k -shortest $N
done
echo DONE
