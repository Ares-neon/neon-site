"""QA for a rendered master.

1. Motion continuity: mean absolute difference between consecutive frames (downscaled luma).
   A pop / missing element shows up as an isolated spike against its neighbours.
2. Static hold: the last N frames must be identical (within encoder noise).
3. Brand fidelity: the last frame is mapped back onto the reference artwork through the
   camera transform and compared on the logo's own pixels.

Usage: python scripts/qa_video.py out/silva-bueno-9x16.mp4 9x16
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
video, fmt = sys.argv[1], sys.argv[2]
W, H = (1080, 1920) if fmt == "9x16" else (1080, 1080)
FINAL_Z = {"9x16": 0.8 * 1.012, "1x1": 0.76 * 1.012}[fmt]
CAM = (633.3, 624.5)

# ---------------------------------------------------------------- 1. continuity
w, h = W // 4, H // 4
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"],
    capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
n = len(frames)
d = np.abs(np.diff(frames, axis=0)).mean((1, 2))
spikes = []
for i in range(len(d)):
    lo, hi = max(0, i - 4), min(len(d), i + 5)
    neigh = np.concatenate([d[lo:i], d[i + 1:hi]])
    base = np.median(neigh) if len(neigh) else 0
    if d[i] > 0.35 and d[i] > 3.0 * base + 0.15:
        spikes.append((i + 1, round(float(d[i]), 3), round(float(base), 3)))
print(f"frames decoded: {n}")
print(f"frame-to-frame MAD: max {d.max():.3f} at frame {int(d.argmax()) + 1}, median {np.median(d):.3f}")
print("isolated spikes (frame, diff, neighbourhood median):", spikes if spikes else "none")

# ---------------------------------------------------------------- 2. static hold
tail = d[-66:]
print(f"last 66 transitions: max diff {tail.max():.4f} (0 = perfectly static)")

# ---------------------------------------------------------------- 3. fidelity of the last frame
last = subprocess.run(["ffmpeg", "-v", "error", "-sseof", "-0.05", "-i", video, "-frames:v", "1", "-f", "image2pipe",
                       "-vcodec", "png", "-"], capture_output=True, check=True).stdout
from io import BytesIO
frame = np.asarray(Image.open(BytesIO(last)).convert("RGB")).astype(np.float32)
ref = np.asarray(Image.open(ROOT / "assets/reference/logo-reference.png").convert("RGB")).astype(np.float32)
geo = json.load(open(ROOT / "src/data/logo.json"))
# reference pixel centre (x+0.5, y+0.5) -> screen
ys, xs = np.mgrid[0:ref.shape[0], 0:ref.shape[1]]
sx = (xs + 0.5 - CAM[0]) * FINAL_Z + W / 2 - 0.5
sy = (ys + 0.5 - CAM[1]) * FINAL_Z + H / 2 - 0.5
x0, y0 = np.floor(sx).astype(int), np.floor(sy).astype(int)
fx, fy = sx - x0, sy - y0
ok = (x0 >= 0) & (y0 >= 0) & (x0 < W - 1) & (y0 < H - 1)
x0c, y0c = np.clip(x0, 0, W - 2), np.clip(y0, 0, H - 2)
samp = (frame[y0c, x0c] * ((1 - fx) * (1 - fy))[..., None] + frame[y0c, x0c + 1] * (fx * (1 - fy))[..., None]
        + frame[y0c + 1, x0c] * ((1 - fx) * fy)[..., None] + frame[y0c + 1, x0c + 1] * (fx * fy)[..., None])
# logo interior: confident logo pixels in the reference, eroded so edges/shadows don't dominate
R, G, B = ref[..., 0], ref[..., 1], ref[..., 2]
Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
inside = (((R - B) > 76) & (R > 107)) | (((ref.max(-1) - ref.min(-1)) < 23) & (Y > 133))
from scipy import ndimage as ndi
inside = ndi.binary_erosion(inside, iterations=2) & ok
err = np.abs(samp - ref)[inside].mean(-1)
print(f"fidelity on {inside.sum()} logo pixels: mean |diff| {err.mean():.2f}/255, 95th pct {np.percentile(err, 95):.2f}, "
      f"median {np.median(err):.2f}")
cmp = np.concatenate([ref, np.where(ok[..., None], samp, 0)], 1)
Image.fromarray(np.clip(cmp, 0, 255).astype(np.uint8)).resize((1254, 627)).save(ROOT / f"cache/fidelity_{fmt}.png")
