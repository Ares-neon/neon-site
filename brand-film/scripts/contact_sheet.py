#!/usr/bin/env python3
"""Tile rendered stills into one labelled contact sheet for review.
usage: python3 scripts/contact_sheet.py out.png still1.png still2.png ... [--w 270] [--cols 4]"""
import sys
from PIL import Image, ImageDraw

args = sys.argv[1:]
w = 270
cols = 4
if "--w" in args:
    i = args.index("--w"); w = int(args[i + 1]); del args[i:i + 2]
if "--cols" in args:
    i = args.index("--cols"); cols = int(args[i + 1]); del args[i:i + 2]
out, files = args[0], args[1:]
h = int(w * 16 / 9)
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 6) + 6, rows * (h + 26) + 6), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for k, fpath in enumerate(files):
    im = Image.open(fpath).convert("RGB").resize((w, h), Image.LANCZOS)
    x = 6 + (k % cols) * (w + 6)
    y = 6 + (k // cols) * (h + 26)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + h + 6), fpath.split("/")[-1], fill=(220, 220, 220))
sheet.save(out)
print(out, sheet.size)
