"""Derive the animation guides (roof vertices, ring circle, building/roof gaps) from src/data/logo.json."""
import json, re, sys
from pathlib import Path
import numpy as np
from skimage import measure

ROOT = Path(__file__).resolve().parent.parent
geo = json.load(open(ROOT / "src/data/logo.json"))
E = geo["elements"]

def polys(d):
    out = []
    for sub in re.findall(r"M([^Z]+)Z", d):
        pts = np.array([[float(v) for v in p.split(",")] for p in sub.split("L")])
        out.append(pts)
    return out

def area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

# --- roof: main outline simplified to its corners
roof = max(polys(E["roof"]["d"]), key=lambda p: abs(area(p)))
simp = measure.approximate_polygon(roof, tolerance=1.6)
print("roof vertices:")
for p in simp[:-1]:
    print(f"  ({p[0]:.1f}, {p[1]:.1f})")

# --- ring: fit circles
def fit_circle(pts):
    x, y = pts[:, 0], pts[:, 1]
    A = np.stack([x, y, np.ones_like(x)], 1)
    b = x**2 + y**2
    c, *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy = c[0] / 2, c[1] / 2
    r = np.sqrt(c[2] + cx**2 + cy**2)
    return cx, cy, r

pts = np.concatenate([max(polys(E[k]["d"]), key=lambda p: abs(area(p))) for k in ("arcL", "arcR")])
cx, cy, r = fit_circle(pts)
rad = np.hypot(pts[:, 0] - cx, pts[:, 1] - cy)
print(f"ring all: c=({cx:.1f},{cy:.1f}) r={r:.1f}  rad range {rad.min():.1f}..{rad.max():.1f}")
for it in range(3):
    outer = pts[rad > r]
    inner = pts[rad <= r]
    co = fit_circle(outer); ci = fit_circle(inner)
print(f"outer circle c=({co[0]:.1f},{co[1]:.1f}) r={co[2]:.1f}")
print(f"inner circle c=({ci[0]:.1f},{ci[1]:.1f}) r={ci[2]:.1f}")
for k in ("arcL", "arcR"):
    p = max(polys(E[k]["d"]), key=lambda p: abs(area(p)))
    ang = np.degrees(np.arctan2(p[:, 1] - cy, p[:, 0] - cx)) % 360
    print(k, "angle range", ang.min().round(1), ang.max().round(1), "n", len(p))
    # unwrap around 0 for arcR
    a2 = (ang + 180) % 360 - 180
    print("   wrapped range", a2.min().round(1), a2.max().round(1))

# --- bounding boxes
for k in ["tower", "bldL", "innerL", "bldR", "lineR1", "lineR2", "bldFR", "win1", "win4", "roof"]:
    print(k, [round(v, 1) for v in E[k]["bbox"]])

# ------------------------------------------------------------------ guides.json
roof_pts = simp[:-1]
# order: find by position
tipL = roof_pts[np.argmin(roof_pts[:, 0])]
tipR = roof_pts[np.argmax(roof_pts[:, 0])]
apex = roof_pts[np.argmin(roof_pts[:, 1])]
mid = roof_pts[(roof_pts[:, 0] > tipL[0] + 1) & (roof_pts[:, 0] < tipR[0] - 1)]
innerApex = min([p for p in mid if abs(p[0] - apex[0]) < 5 and p[1] > apex[1] + 5], key=lambda p: p[1])
lefts = [p for p in mid if p[0] < apex[0] - 50]
rights = [p for p in mid if p[0] > apex[0] + 50]
kneeTopL = min(lefts, key=lambda p: p[1]); kneeBotL = max(lefts, key=lambda p: p[1])
kneeTopR = min(rights, key=lambda p: p[1]); kneeBotR = max(rights, key=lambda p: p[1])
axisX = float((tipL[0] + tipR[0] + apex[0] * 2) / 4)
baseline = float((tipL[1] + tipR[1]) / 2)
outer = [tipL, kneeTopL, apex, kneeTopR, tipR]

CLIP_LIFT = 10.0

def clip_y(x):
    xs = [p[0] for p in outer]; ys = [p[1] for p in outer]
    return np.interp(x, xs, ys) - CLIP_LIFT

hide = {}
for k in ["tower", "bldL", "bldR", "bldFR", "innerL", "lineR1", "lineR2"]:
    pts = np.concatenate(polys(E[k]["d"]))
    hide[k] = float(np.max(clip_y(pts[:, 0]) - pts[:, 1]) + 3.0)
    gap = float(np.min(clip_y(pts[:, 0]) + CLIP_LIFT - pts[:, 1]))
    print(f"{k}: hide offset {hide[k]:.1f}, min gap to roof edge {gap:.1f}")

ring_pts = np.concatenate([max(polys(E[k]["d"]), key=lambda p: abs(area(p))) for k in ("arcL", "arcR")])
rr = np.hypot(ring_pts[:, 0] - cx, ring_pts[:, 1] - cy)
angL = np.degrees(np.arctan2(*(max(polys(E["arcL"]["d"]), key=lambda p: abs(area(p)))[:, ::-1] - [cy, cx]).T)) % 360
angR = (np.degrees(np.arctan2(*(max(polys(E["arcR"]["d"]), key=lambda p: abs(area(p)))[:, ::-1] - [cy, cx]).T)) + 360) % 360
angR = np.where(angR < 180, angR + 360, angR)

name_ids = [k for k in E if k.startswith("name_")]
imv_ids = [k for k in E if k.startswith("imv_") or k.startswith("rule")]
guides = dict(
    axisX=axisX, baselineY=baseline, clipLift=CLIP_LIFT,
    roof=dict(tipL=tipL.tolist(), kneeTopL=kneeTopL.tolist(), apex=apex.tolist(), kneeTopR=kneeTopR.tolist(),
              tipR=tipR.tolist(), kneeBotR=kneeBotR.tolist(), innerApex=innerApex.tolist(), kneeBotL=kneeBotL.tolist()),
    ring=dict(cx=float(cx), cy=float(cy), rMin=float(rr.min()), rMax=float(rr.max()),
              startDeg=float(angL.min()), gapFromDeg=float(angL.max()), gapToDeg=float(angR.min()), endDeg=float(angR.max())),
    hide=hide,
    name=dict(top=min(E[k]["bbox"][1] for k in name_ids), bottom=max(E[k]["bbox"][3] for k in name_ids),
              left=min(E[k]["bbox"][0] for k in name_ids), right=max(E[k]["bbox"][2] for k in name_ids)),
    imoveis=dict(top=min(E[k]["bbox"][1] for k in imv_ids), bottom=max(E[k]["bbox"][3] for k in imv_ids),
                 left=min(E[k]["bbox"][0] for k in imv_ids), right=max(E[k]["bbox"][2] for k in imv_ids)),
    logo=dict(top=min(e["bbox"][1] for e in E.values()), bottom=max(e["bbox"][3] for e in E.values()),
              left=min(e["bbox"][0] for e in E.values()), right=max(e["bbox"][2] for e in E.values())),
)
json.dump(guides, open(ROOT / "src/data/guides.json", "w"), indent=1)
print(json.dumps(guides, indent=1))
