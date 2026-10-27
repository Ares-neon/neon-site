"""Extract the Silva & Bueno logo from the reference raster into animatable layers.

The reference is a raster mockup (no vector master), so nothing is redrawn:
every element keeps its original pixels. Steps:
  1. model the wall background and pull a soft alpha matte (known-colour matting)
  2. split the matte into the brand elements (connected components + position rules)
  3. trace each element's 0.5 iso-contour (sub-pixel) -> SVG path for clips/highlights
  4. write one RGBA texture per element at 2x with defringed colours

Usage: python scripts/extract_logo.py [--debug out_dir]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import measure

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/reference/logo-reference.png"
OUT_DIR = ROOT / "public/logo"
GEOM = ROOT / "src/data/logo.json"
UP = 2  # texture upscale factor

img = np.asarray(Image.open(SRC).convert("RGB")).astype(np.float64) / 255.0
H, W, _ = img.shape
R, G, B = img[..., 0], img[..., 1], img[..., 2]
Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
chroma = img.max(-1) - img.min(-1)

# ---------------------------------------------------------------- 1. matte
gold_rough = (R - B > 0.18) & (R > 0.30)
silver_rough = (chroma < 0.14) & (Y > 0.30)
fg_rough = gold_rough | silver_rough
near_fg = ndi.binary_dilation(fg_rough, iterations=18)

# smooth wall model: robust 2D polynomial per channel on pixels far from the logo
yy, xx = np.mgrid[0:H, 0:W]
u, v = xx / W - 0.5, yy / H - 0.5
deg = 4
terms = [(i, j) for i in range(deg + 1) for j in range(deg + 1 - i)]
A_full = np.stack([u**i * v**j for i, j in terms], -1)
bg_sel = ~near_fg
bg_sel[::3, ::3] &= True
idx = np.flatnonzero(bg_sel.ravel()[:])[::7]
A = A_full.reshape(-1, len(terms))[idx]
bg_model = np.zeros_like(img)
for c in range(3):
    t = img[..., c].ravel()[idx]
    keep = np.ones(len(t), bool)
    for _ in range(3):
        coef, *_ = np.linalg.lstsq(A[keep], t[keep], rcond=None)
        res = A @ coef - t
        keep = np.abs(res) < 2.5 * res[keep].std() + 1e-4
    bg_model[..., c] = (A_full @ coef).reshape(H, W)

gold_conf = (R - B > 0.30) & (R > 0.42)
silver_conf = (chroma < 0.09) & (Y > 0.52)
fg_conf = ndi.binary_erosion(gold_conf | silver_conf, iterations=1)
dist_bg = np.abs(img - bg_model).max(-1)
bg_conf = ((dist_bg < 0.05) | ((Y < 0.16) & (B - R > 0.04))) & ~ndi.binary_dilation(fg_conf, iterations=1)

# nearest confident colours
_, fi = ndi.distance_transform_edt(~fg_conf, return_indices=True)
F = img[fi[0], fi[1]]
_, bi = ndi.distance_transform_edt(~bg_conf, return_indices=True)
Bk = img[bi[0], bi[1]]
d = F - Bk
alpha = ((img - Bk) * d).sum(-1) / np.maximum((d * d).sum(-1), 1e-4)
alpha = np.clip(alpha, 0, 1)
alpha[fg_conf] = 1.0
alpha[bg_conf] = 0.0

# ---------------------------------------------------------------- 2. elements
solid = alpha > 0.5
lab, n = ndi.label(solid, structure=np.ones((3, 3)))
objs = ndi.find_objects(lab)
comps = []
for k, sl in enumerate(objs, start=1):
    m = lab[sl] == k
    area = int(m.sum())
    if area < 12:
        continue
    ys, xs = np.nonzero(m)
    y0, x0 = sl[0].start, sl[1].start
    col = img[sl][m].mean(0)
    comps.append(dict(k=k, area=area, x0=int(x0 + xs.min()), x1=int(x0 + xs.max()), y0=int(y0 + ys.min()),
                      y1=int(y0 + ys.max()), cx=float(x0 + xs.mean()), cy=float(y0 + ys.mean()),
                      gold=bool(col[0] - col[2] > 0.2)))

if "--list" in sys.argv:
    for c in sorted(comps, key=lambda c: (c["y0"] // 60, c["x0"])):
        print(c)
    print(len(comps), "components")
    sys.exit(0)

# name the components ---------------------------------------------------------
SYMBOL_REF = {  # expected centroids (x, y) in reference pixels -> element id
    "tower": (604, 341), "arcL": (412, 477), "arcR": (821, 446), "bldL": (505, 482),
    "innerL": (574, 465), "bldR": (673, 393), "bldFR": (765, 486), "lineR1": (698, 475),
    "lineR2": (718, 475), "roof": (633, 628), "win1": (612, 638), "win2": (649, 638),
    "win3": (612, 675), "win4": (649, 675),
}
NAME_GLYPHS = ["S", "I", "L", "V", "A", "amp", "B", "U", "E", "N", "O"]
IMV_GLYPHS = ["I1", "M", "O", "V", "E", "I2", "S"]

names = {}
symbol = [c for c in comps if c["y1"] < 730]
for c in symbol:
    best = min(SYMBOL_REF, key=lambda k: (SYMBOL_REF[k][0] - c["cx"]) ** 2 + (SYMBOL_REF[k][1] - c["cy"]) ** 2)
    names[c["k"]] = best
name_row = sorted([c for c in comps if 735 <= c["y0"] < 880], key=lambda c: c["x0"])
assert len(name_row) == len(NAME_GLYPHS), len(name_row)
for c, g in zip(name_row, NAME_GLYPHS):
    names[c["k"]] = "name_" + g
imv_row = [c for c in comps if c["y0"] >= 885]
rules = [c for c in imv_row if c["x1"] - c["x0"] > 150]
for c in rules:
    names[c["k"]] = "ruleL" if c["cx"] < W / 2 else "ruleR"
accent = [c for c in imv_row if c["y1"] < 905]
glyphs = sorted([c for c in imv_row if c not in rules and c not in accent], key=lambda c: c["x0"])
assert len(glyphs) == len(IMV_GLYPHS) and len(accent) == 1
for c, g in zip(glyphs, IMV_GLYPHS):
    names[c["k"]] = "imv_" + g
names[accent[0]["k"]] = "imv_O"  # the acute accent travels with its O
assert len(set(names.values())) == len(SYMBOL_REF) + len(NAME_GLYPHS) + len(IMV_GLYPHS) + 2, sorted(names.values())

# ---------------------------------------------------------------- 3+4. contours & textures
Z = 4  # contour supersampling
K_SHARP = 2.2  # edge sharpening of the 2x alpha (keeps the 0.5 iso-line in place)
unmix = np.clip((img - (1 - alpha[..., None]) * Bk) / np.maximum(alpha[..., None], 1e-3), 0, 1)
colour = np.where((alpha > 0.6)[..., None], unmix, F)
colour = np.where((alpha > 0.97)[..., None], img, colour)

OUT_DIR.mkdir(parents=True, exist_ok=True)
elements = {}
for eid in sorted(set(names.values())):
    ks = [k for k, v in names.items() if v == eid]
    m = np.isin(lab, ks)
    region = ndi.binary_dilation(m, iterations=3)
    ys, xs = np.nonzero(region)
    pad = 3
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W)
    a = (alpha * region)[y0:y1, x0:x1]
    # sub-pixel outline (SVG units: pixel i covers [i, i+1))
    az = ndi.zoom(a, Z, order=3, grid_mode=True, mode="nearest")
    paths = []
    for cnt in measure.find_contours(np.pad(az, 1), 0.5):
        cnt = measure.approximate_polygon(cnt - 1, tolerance=0.25)
        if len(cnt) < 4:
            continue
        pts = [(x0 + (c + 0.5) / Z, y0 + (r + 0.5) / Z) for r, c in cnt[:-1]]
        paths.append("M" + "L".join(f"{px:.2f},{py:.2f}" for px, py in pts) + "Z")
    # texture at UP x
    a2 = ndi.zoom(a, UP, order=3, grid_mode=True, mode="nearest")
    a2 = np.clip((a2 - 0.5) * K_SHARP + 0.5, 0, 1)
    rgb = np.stack([ndi.zoom(colour[y0:y1, x0:x1, c], UP, order=3, grid_mode=True, mode="nearest") for c in range(3)], -1)
    rgba = np.concatenate([np.clip(rgb, 0, 1), a2[..., None]], -1)
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA").save(OUT_DIR / f"{eid}.png", optimize=True)
    w_ = (a > 0.5)
    yy_, xx_ = np.nonzero(w_)
    elements[eid] = dict(
        id=eid, gold=bool(np.median(img[y0:y1, x0:x1][w_], 0)[0] - np.median(img[y0:y1, x0:x1][w_], 0)[2] > 0.2),
        x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0),
        bbox=[float(x0 + xx_.min()), float(y0 + yy_.min()), float(x0 + xx_.max() + 1), float(y0 + yy_.max() + 1)],
        cx=float(x0 + xx_.mean() + 0.5), cy=float(y0 + yy_.mean() + 0.5),
        d="".join(paths),
    )

GEOM.parent.mkdir(parents=True, exist_ok=True)
json.dump(dict(width=W, height=H, upscale=UP, elements=elements), open(GEOM, "w"), indent=1)
print("wrote", len(elements), "elements")

if "--debug" in sys.argv:
    dbg = Path(sys.argv[sys.argv.index("--debug") + 1])
    dbg.mkdir(parents=True, exist_ok=True)
    Image.fromarray((alpha * 255).astype(np.uint8)).save(dbg / "alpha.png")
    Image.fromarray((np.clip(bg_model, 0, 1) * 255).astype(np.uint8)).save(dbg / "bg_model.png")
    # recomposite on flat navy at 1x to compare with the reference
    navy = np.array([11, 30, 51]) / 255.0
    comp = np.ones((H * UP, W * UP, 3)) * navy
    for e in elements.values():
        t = np.asarray(Image.open(OUT_DIR / f"{e['id']}.png")).astype(np.float64) / 255
        ys_, xs_ = e["y"] * UP, e["x"] * UP
        sub = comp[ys_:ys_ + t.shape[0], xs_:xs_ + t.shape[1]]
        sub[:] = sub * (1 - t[..., 3:]) + t[..., :3] * t[..., 3:]
    Image.fromarray((comp * 255 + 0.5).astype(np.uint8)).resize((W, H), Image.LANCZOS).save(dbg / "recomposite.png")
