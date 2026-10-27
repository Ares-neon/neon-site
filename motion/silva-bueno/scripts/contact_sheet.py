"""Tile preview frames (fNNNN.jpg) into one labelled contact sheet.
Usage: python3 scripts/contact_sheet.py <frames_dir> <out.jpg> [cols] [fps]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, out = Path(sys.argv[1]), Path(sys.argv[2])
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fps = float(sys.argv[4]) if len(sys.argv) > 4 else 60
files = sorted(src.glob("f*.jpg"))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
pad = 4
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad) + pad), (32, 32, 32))
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
except OSError:
    font = ImageFont.load_default()
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = pad + (i % cols) * (w + pad), pad + (i // cols) * (h + pad)
    sheet.paste(im, (x, y))
    fr = int(f.stem[1:])
    d = ImageDraw.Draw(sheet)
    label = f"{fr}  {fr / fps:.2f}s"
    tw = d.textlength(label, font=font)
    d.rectangle([x + 3, y + h - 20, x + 9 + tw, y + h - 3], fill=(0, 0, 0))
    d.text((x + 6, y + h - 19), label, fill=(255, 255, 255), font=font)
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out, quality=88)
print("sheet:", out, f"({len(ims)} frames)")
