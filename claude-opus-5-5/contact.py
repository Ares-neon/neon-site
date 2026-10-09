"""Contact sheet: python3 contact.py <stills_dir> <out.png> [cols] [thumb_w]"""
import sys, os, re
from PIL import Image, ImageDraw, ImageFont
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 270
files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
th = tw * 1920 // 1080
rows = (len(files) + cols - 1) // cols
pad, lab = 8, 22
sheet = Image.new('RGB', (cols * (tw + pad) + pad, rows * (th + pad + lab) + pad), (40, 40, 44))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Medium.otf', 14)
except Exception:
    font = ImageFont.load_default()
for k, f in enumerate(files):
    im = Image.open(os.path.join(src, f)).convert('RGB').resize((tw, th), Image.LANCZOS)
    x = pad + (k % cols) * (tw + pad); y = pad + (k // cols) * (th + pad + lab)
    sheet.paste(im, (x, y + lab))
    t = re.sub(r'^t0*', '', f[:-4]) or '0'
    d.text((x + 2, y + 3), f't = {float(t):.2f}s', fill=(230, 230, 230), font=font)
sheet.save(out)
print(out, sheet.size)
