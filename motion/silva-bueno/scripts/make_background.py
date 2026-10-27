"""Studio backdrop: deep navy (#0B1E33) with a soft key light behind the mark, a faint
top-right fill (echoing the reference lighting) and a near-black blue vignette.
Rendered in float and dithered to 8 bit so the gradient never bands after H.264.

Usage: python scripts/make_background.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/bg"

BASE = np.array([11, 30, 51], float)      # #0B1E33 — brand navy
KEY = np.array([17, 40, 66], float)       # light pooled behind the mark
FILL = np.array([22, 47, 74], float)      # top-right fill, as in the reference wall
SHADOW = np.array([3, 10, 21], float)     # near-black blue at the corners


def backdrop(w, h, key_y, seed):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    s = max(w, h)
    # key light: wide elliptical pool behind the logo
    rk = np.hypot((xx - w * 0.5) / (s * 0.42), (yy - key_y) / (s * 0.38))
    key = np.exp(-(rk ** 2) * 1.15)
    # fill from the top-right, very low
    rf = np.hypot((xx - w * 1.05) / (s * 0.75), (yy + h * 0.05) / (s * 0.75))
    fill = np.exp(-(rf ** 2) * 1.6) * 0.45
    # vignette towards the edges
    rv = np.hypot((xx - w * 0.5) / (w * 0.62), (yy - h * 0.5) / (h * 0.62))
    vig = np.clip((rv - 0.55) / 0.75, 0, 1) ** 1.6

    col = BASE[None, None] * (1 - key[..., None]) + KEY[None, None] * key[..., None]
    col = col * (1 - fill[..., None]) + FILL[None, None] * fill[..., None]
    col = col * (1 - vig[..., None] * 0.85) + SHADOW[None, None] * (vig[..., None] * 0.85)
    rng = np.random.default_rng(seed)
    dither = rng.random((h, w, 1)) - rng.random((h, w, 1))  # triangular, +-1 LSB
    grain = rng.normal(0, 0.55, (h, w, 1))
    out = np.clip(np.round(col + dither + grain), 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGB")


OUT.mkdir(parents=True, exist_ok=True)
backdrop(1080, 1920, key_y=1920 * 0.47, seed=7).save(OUT / "bg-9x16.png", optimize=True)
backdrop(1080, 1080, key_y=1080 * 0.48, seed=11).save(OUT / "bg-1x1.png", optimize=True)
print("backgrounds written to", OUT)
