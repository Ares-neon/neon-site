"""Measure the Instagram end card in a rendered master, frame by frame.

Checks the brief: entrance of ~12 px with an opacity ramp, centred under IMÓVEIS,
complete composition static for >= 1 s at the end.

Usage: python scripts/qa_handle.py out/silva-bueno-9x16.mp4 9x16
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
video, fmt = sys.argv[1], sys.argv[2]
W, H = (1080, 1920) if fmt == "9x16" else (1080, 1080)
Z = {"9x16": 0.8 * 1.012, "1x1": 0.76 * 1.012}[fmt]
CX, CY = 633.3, 624.5
FPS = 60
geo = json.load(open(ROOT / "src/data/logo.json"))["elements"]

to_sx = lambda x: (x - CX) * Z + W / 2
to_sy = lambda y: (y - CY) * Z + H / 2

# crop around the handle (reference y 990..1060) in final-frame coordinates
even = lambda v: int(v) // 2 * 2  # chroma-subsampled video: crop on even coordinates
y0, y1 = even(to_sy(990)), even(to_sy(1062))
x0, x1 = even(to_sx(300)), even(to_sx(970))
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"crop={x1 - x0}:{y1 - y0}:{x0}:{y0},format=gray",
                      "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, y1 - y0, x1 - x0).astype(np.float32)
bg = np.median(fr[700])  # handle not on screen yet
ink = np.clip(fr - bg - 6, 0, None)

final = ink[-1]
mask = final > 60
ys, xs = np.nonzero(mask)
cy_final = (ink[-1] * np.arange(ink.shape[1])[:, None]).sum() / ink[-1].sum()
print(f"handle bbox in final frame: x {x0 + xs.min()}..{x0 + xs.max()}  y {y0 + ys.min()}..{y0 + ys.max()}")
text_cx = x0 + (xs.min() + xs.max() + 1) / 2
imv_letters = [geo[k]["bbox"] for k in geo if k.startswith("imv_")]
imv_cx = to_sx((min(b[0] for b in imv_letters) + max(b[2] for b in imv_letters)) / 2)
print(f"handle centre x {text_cx:.1f} px | IMÓVEIS letters centre {imv_cx:.1f} px | frame centre {W / 2:.1f} px "
      f"-> offset vs IMÓVEIS {text_cx - imv_cx:+.1f} px")
cap = (ys.max() - ys.min() + 1)
print(f"handle height (with @ descent) {cap} px; IMÓVEIS cap height {(max(b[3] for b in imv_letters) - min(b[1] for b in imv_letters)) * Z:.0f} px")

print("\nframe   time    opacity   vertical offset (px, + = below final)")
for f in list(range(772, 840, 4)) + [899]:
    w = ink[f].sum()
    op = w / ink[-1].sum()
    if w > 1e3:
        cy = (ink[f] * np.arange(ink.shape[1])[:, None]).sum() / w
        off = cy - cy_final
        print(f"{f:5d}  {f / FPS:5.2f}s   {op:6.3f}    {off:+6.2f}")
    else:
        print(f"{f:5d}  {f / FPS:5.2f}s   {op:6.3f}       —")

d = np.abs(np.diff(fr, axis=0)).max((1, 2))
static_from = len(d)
while static_from > 0 and d[static_from - 1] <= 2:
    static_from -= 1
print(f"\nhandle region pixel-identical (<=2 levels) from frame {static_from} -> {(len(fr) - static_from) / FPS:.2f} s static")
