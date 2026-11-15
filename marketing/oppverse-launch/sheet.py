# contact sheet of probe stills: python3 sheet.py out.png t1 t2 ...
import sys
from PIL import Image, ImageDraw
out, ts = sys.argv[1], sys.argv[2:]
W, H = 960, 540; cols = 2; rows = (len(ts) + 1) // 2
sheet = Image.new('RGB', (W * cols, H * rows), (40, 40, 40))
for i, t in enumerate(ts):
    im = Image.open(f'probe/t_{float(t):.2f}.png').convert('RGB').resize((W, H), Image.LANCZOS)
    ImageDraw.Draw(im).text((12, 10), t, fill=(255, 80, 80))
    sheet.paste(im, ((i % cols) * W, (i // cols) * H))
sheet.save(out)
