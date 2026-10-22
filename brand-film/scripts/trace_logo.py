#!/usr/bin/env python3
"""Vectorize the official NEON logo and verify the trace against the source.

Source of truth: assets/source/neon-logo-original.png (1536x1024, RGBA, the
upload used by the NEON landing page). assets/source/neon-logo-reference.jpg is
the copy delivered with the brief (1280x853); it has the same layout and is
used as a second fidelity check.

Outputs
  public/logo/neon-logo.svg          full lockup (symbol + wordmark)
  public/logo/neon-symbol.svg        symbol only
  public/textures/neon-symbol-sdf.png signed distance field (scene 13 relief)
  src/logo/logoData.ts               path data consumed by the React components
  assets/source/trace-report.json    fidelity metrics

Run: python3 scripts/trace_logo.py
"""
import json
from pathlib import Path

import cv2
import numpy as np
import potrace
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/source/neon-logo-original.png"
REF = ROOT / "assets/source/neon-logo-reference.jpg"
UP = 6  # supersampling factor used before thresholding (sub-pixel edges)
GREEN = "#00E63B"
WHITE = "#FFFFFF"


def coverage(rgba):
    r, g, b, a = [rgba[..., i].astype(np.float32) for i in range(4)]
    a = a / 255.0
    # Green strokes: chroma (G - max(R, B)) is ~174 inside, ~0 on the dark
    # separator line and < 45 in the glow, so it isolates the strokes cleanly.
    green = np.clip(((g - np.maximum(r, b)) * a - 20.0) / 154.0, 0, 1)
    # White parts (bolt + wordmark): min channel is ~250 inside, < 60 elsewhere.
    white = np.clip((np.minimum(np.minimum(r, g), b) * a - 40.0) / 210.0, 0, 1)
    return green, white


def trace_region(cov, x0, y0, x1, y1):
    """Trace cov[y0:y1, x0:x1] at UP x resolution. Returns list of curves in
    source pixel coordinates: [(start, [segments...])]."""
    crop = cov[y0:y1, x0:x1]
    big = cv2.resize(crop, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    mask = big > 0.5
    bm = potrace.Bitmap(~mask)  # potracer traces the False pixels of its input
    plist = bm.trace(turdsize=UP * UP * 3, alphamax=1.0, opticurve=True, opttolerance=0.2)
    curves = []
    for curve in plist:
        def P(p):
            return (x0 + p.x / UP, y0 + p.y / UP)

        segs = []
        for s in curve:
            if s.is_corner:
                segs.append(("L", P(s.c), P(s.end_point)))
            else:
                segs.append(("C", P(s.c1), P(s.c2), P(s.end_point)))
        curves.append((P(curve.start_point), segs))
    return curves


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s if s != "-0" else "0"


def curves_to_d(curves, dx=0.0, dy=0.0):
    out = []
    for start, segs in curves:
        out.append(f"M{fmt(start[0] - dx)} {fmt(start[1] - dy)}")
        for s in segs:
            if s[0] == "L":
                out.append(f"L{fmt(s[1][0] - dx)} {fmt(s[1][1] - dy)}L{fmt(s[2][0] - dx)} {fmt(s[2][1] - dy)}")
            else:
                out.append(
                    "C" + " ".join(f"{fmt(p[0] - dx)} {fmt(p[1] - dy)}" for p in s[1:])
                )
        out.append("Z")
    return "".join(out)


def flatten(start, segs, steps=24):
    pts = [start]
    cur = start
    for s in segs:
        if s[0] == "L":
            pts += [s[1], s[2]]
            cur = s[2]
        else:
            p0, p1, p2, p3 = np.array(cur), np.array(s[1]), np.array(s[2]), np.array(s[3])
            for i in range(1, steps + 1):
                t = i / steps
                q = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
                pts.append(tuple(q))
            cur = s[3]
    return np.array(pts)


def rasterize(curves, w, h, scale=1.0, ox=0.0, oy=0.0):
    """Even-odd fill of the traced curves (XOR of every contour)."""
    acc = np.zeros((h, w), np.uint8)
    for start, segs in curves:
        poly = flatten(start, segs)
        poly = ((poly - [ox, oy]) * scale * 16).round().astype(np.int32)  # 4 bits subpixel
        m = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m, [poly], 1, lineType=cv2.LINE_8, shift=4)
        acc ^= m
    return acc


def bbox_of(curves):
    pts = np.concatenate([flatten(s, g) for s, g in curves])
    return pts[:, 0].min(), pts[:, 1].min(), pts[:, 0].max(), pts[:, 1].max()


def components(curves):
    """Group contours into filled pieces (outer contour + its holes)."""
    polys = [flatten(s, g) for s, g in curves]
    areas = [0.5 * np.sum(p[:-1, 0] * p[1:, 1] - p[1:, 0] * p[:-1, 1]) for p in polys]
    outer_sign = np.sign(areas[int(np.argmax(np.abs(areas)))])
    pieces = []
    for i, c in enumerate(curves):
        if np.sign(areas[i]) == outer_sign:
            pieces.append([c])
    for i, c in enumerate(curves):
        if np.sign(areas[i]) != outer_sign:
            pt = tuple(polys[i][0])
            for piece in pieces:
                if cv2.pointPolygonTest(polys[curves.index(piece[0])].astype(np.float32), pt, False) > 0:
                    piece.append(c)
                    break
    return pieces


def main():
    rgba = np.array(Image.open(SRC).convert("RGBA"))
    H, W = rgba.shape[:2]
    green, white = coverage(rgba)

    gy, gx = np.nonzero(green > 0.5)
    sym_box = (gx.min() - 6, gy.min() - 6, gx.max() + 7, gy.max() + 7)
    split_x = sym_box[2] + 20  # wordmark starts right of the symbol
    wb = white.copy()
    wb[:, split_x:] = 0
    by, bx = np.nonzero(wb > 0.5)
    bolt_box = (bx.min() - 6, by.min() - 6, bx.max() + 7, by.max() + 7)
    ww = white.copy()
    ww[:, :split_x] = 0
    wy, wx = np.nonzero(ww > 0.5)
    word_box = (wx.min() - 6, wy.min() - 6, wx.max() + 7, wy.max() + 7)

    sym_curves = trace_region(green, *sym_box)
    bolt_curves = trace_region(wb, *bolt_box)
    word_curves = trace_region(ww, *word_box)

    # ---------- fidelity check against the source raster -----------------
    report = {}
    for name, curves, cov in (("symbol", sym_curves, green), ("bolt", bolt_curves, wb), ("wordmark", word_curves, ww)):
        ref = cov > 0.5
        hi = rasterize(curves, W * 4, H * 4, scale=4)
        lo = cv2.resize(hi.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA) > 0.5
        iou = float((lo & ref).sum() / max(1, (lo | ref).sum()))
        # contour deviation in source pixels (distance from traced outline to the
        # supersampled reference outline)
        ref_hi = cv2.resize(cov, (W * 4, H * 4), interpolation=cv2.INTER_CUBIC) > 0.5
        edge_ref = cv2.Canny(ref_hi.astype(np.uint8) * 255, 50, 150) > 0
        dist = cv2.distanceTransform((~edge_ref).astype(np.uint8), cv2.DIST_L2, 5) / 4.0
        edge_tr = cv2.Canny(hi * 255, 50, 150) > 0
        d = dist[edge_tr]
        report[name] = {
            "iou_vs_source": round(iou, 4),
            "mean_edge_deviation_px": round(float(d.mean()), 3),
            "p99_edge_deviation_px": round(float(np.percentile(d, 99)), 3),
            "contours": len(curves),
        }

    # second check: the brief's JPG (same layout at 1280/1536 scale)
    jpg = np.array(Image.open(REF).convert("RGB")).astype(np.float32)
    jr, jg, jb = jpg[..., 0], jpg[..., 1], jpg[..., 2]
    jh, jw = jpg.shape[:2]
    s = jw / W
    jgreen = (jg - np.maximum(jr, jb)) > 97
    jwhite = np.minimum(np.minimum(jr, jg), jb) > 145
    tg = cv2.resize(rasterize(sym_curves, W * 4, H * 4, scale=4).astype(np.float32), (jw, jh), interpolation=cv2.INTER_AREA) > 0.5
    tw = cv2.resize(rasterize(bolt_curves + word_curves, W * 4, H * 4, scale=4).astype(np.float32), (jw, jh), interpolation=cv2.INTER_AREA) > 0.5
    report["reference_jpg"] = {
        "scale": round(s, 5),
        "iou_symbol": round(float((tg & jgreen).sum() / (tg | jgreen).sum()), 4),
        "iou_white": round(float((tw & jwhite).sum() / (tw | jwhite).sum()), 4),
        "note": "JPEG artefacts and a 1px glow/separator ring at this scale bound the attainable IoU",
    }

    # ---------- layout ----------------------------------------------------
    sb = np.array(bbox_of(sym_curves + bolt_curves))
    wbx = np.array(bbox_of(word_curves))
    full = (min(sb[0], wbx[0]), min(sb[1], wbx[1]), max(sb[2], wbx[2]), max(sb[3], wbx[3]))
    ox, oy = full[0], full[1]
    fw, fh = full[2] - full[0], full[3] - full[1]

    sym_d = curves_to_d(sym_curves, ox, oy)
    bolt_d = curves_to_d(bolt_curves, ox, oy)
    word_d = curves_to_d(word_curves, ox, oy)

    pieces = []
    for piece in components(sym_curves):
        bx0, by0, bx1, by1 = bbox_of(piece)
        pieces.append({
            "d": curves_to_d(piece, ox, oy),
            "bbox": [round(bx0 - ox, 2), round(by0 - oy, 2), round(bx1 - ox, 2), round(by1 - oy, 2)],
        })
    letters = []
    for piece in sorted(components(word_curves), key=lambda p: bbox_of(p)[0]):
        bx0, by0, bx1, by1 = bbox_of(piece)
        letters.append({
            "d": curves_to_d(piece, ox, oy),
            "bbox": [round(bx0 - ox, 2), round(by0 - oy, 2), round(bx1 - ox, 2), round(by1 - oy, 2)],
        })

    symbol_box = [round(sb[0] - ox, 2), round(sb[1] - oy, 2), round(sb[2] - ox, 2), round(sb[3] - oy, 2)]
    word_box_rel = [round(wbx[0] - ox, 2), round(wbx[1] - oy, 2), round(wbx[2] - ox, 2), round(wbx[3] - oy, 2)]

    (ROOT / "public/logo").mkdir(parents=True, exist_ok=True)
    (ROOT / "src/logo").mkdir(parents=True, exist_ok=True)
    (ROOT / "public/textures").mkdir(parents=True, exist_ok=True)

    svg_full = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(fw)} {fmt(fh)}">'
        f'<path fill="{GREEN}" fill-rule="evenodd" d="{sym_d}"/>'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{bolt_d}"/>'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{word_d}"/></svg>\n'
    )
    (ROOT / "public/logo/neon-logo.svg").write_text(svg_full)
    sx0, sy0, sx1, sy1 = symbol_box
    svg_sym = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(sx0)} {fmt(sy0)} {fmt(sx1 - sx0)} {fmt(sy1 - sy0)}">'
        f'<path fill="{GREEN}" fill-rule="evenodd" d="{sym_d}"/>'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{bolt_d}"/></svg>\n'
    )
    (ROOT / "public/logo/neon-symbol.svg").write_text(svg_sym)

    data = {
        "width": round(fw, 2),
        "height": round(fh, 2),
        "symbolBox": symbol_box,
        "wordmarkBox": word_box_rel,
        "symbol": sym_d,
        "bolt": bolt_d,
        "wordmark": word_d,
        "symbolPieces": pieces,
        "letters": letters,
    }
    ts = (
        "// Generated by scripts/trace_logo.py from assets/source/neon-logo-original.png.\n"
        "// Do not edit by hand: re-run `npm run logo`.\n"
        "export const LOGO = " + json.dumps(data, indent=1) + " as const;\n"
    )
    (ROOT / "src/logo/logoData.ts").write_text(ts)

    # ---------- signed distance field of the symbol (scene 13 relief) ------
    N = 1024
    pad = 0.14
    scale = (N * (1 - 2 * pad)) / max(sx1 - sx0, sy1 - sy0)
    offx = (N - (sx1 - sx0) * scale) / 2 - sx0 * scale
    offy = (N - (sy1 - sy0) * scale) / 2 - sy0 * scale
    shift = lambda cs: [((s[0] - ox, s[1] - oy), [(g[0],) + tuple((p[0] - ox, p[1] - oy) for p in g[1:]) for g in segs]) for s, segs in cs]
    sym_rel = shift(sym_curves)
    bolt_rel = shift(bolt_curves)
    sdf_px = []
    for cs in (sym_rel, bolt_rel):
        m = np.zeros((N, N), np.uint8)
        for start, segs in cs:
            poly = flatten(start, segs) * scale + [offx, offy]
            mm = np.zeros((N, N), np.uint8)
            cv2.fillPoly(mm, [(poly * 16).round().astype(np.int32)], 1, lineType=cv2.LINE_AA, shift=4)
            m ^= (mm > 0).astype(np.uint8)
        sdf_px.append(m)
    mask = np.maximum(sdf_px[0], sdf_px[1])
    din = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    dout = cv2.distanceTransform(1 - mask, cv2.DIST_L2, 5)
    sd = dout - din  # negative inside
    R = 24.0
    enc = np.clip(0.5 + sd / (2 * R), 0, 1)
    rgb = np.stack([
        (enc * 255).round(),
        (sdf_px[0] * 255),  # G: green strokes mask
        (sdf_px[1] * 255),  # B: bolt mask
    ], -1).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(ROOT / "public/textures/neon-symbol-sdf.png")
    report["sdf"] = {"size": N, "range_px": R, "symbol_scale": round(scale, 4)}

    (ROOT / "assets/source/trace-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    print("viewBox", fw, fh, "symbol", symbol_box, "wordmark", word_box_rel, "pieces", len(pieces), "letters", len(letters))


if __name__ == "__main__":
    main()
