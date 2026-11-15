"""Generate the voice-over, one phrase per file, with Kokoro (open-weights TTS, runs locally).

    /opt/tts/bin/python vo_tts.py [voice] [speed]   -> vo/NN.wav (24 kHz mono)

The phrase list is VO in story.py's order; mix.py places each file on its beat.
"""
import os, sys
import numpy as np, soundfile as sf
from kokoro import KPipeline

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from story import VO

voice = sys.argv[1] if len(sys.argv) > 1 else 'af_heart'
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 0.95
# the brand says it aka-DEM-ia, not the dictionary's aka-DEE-mia
SAY = {'Academia': '[Academia](/ˌækəˈdɛmiə/)'}
pipe = KPipeline(lang_code='a' if voice[0] == 'a' else 'b', repo_id='hexgrad/Kokoro-82M')
os.makedirs(os.path.join(HERE, 'vo'), exist_ok=True)
for k, (t, text, *rest) in enumerate(VO):
    sp = speed * (rest[0] if rest else 1)
    for w, p in SAY.items(): text = text.replace(w, p)
    audio = np.concatenate([np.asarray(a) for _, _, a in pipe(text, voice=voice, speed=sp)])
    sf.write(os.path.join(HERE, 'vo', f'{k:02d}.wav'), audio, 24000)
    print(f'{k:2d} {t:6.2f}  {len(audio) / 24000:4.2f}s  {text}')
