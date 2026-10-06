"""Extrai os elementos da logo original (sem redesenhar) e prepara a foto.

Saídas em assets/:
  face.png          linha do rosto (RGBA, dourado original + alpha)
  face-order.png    ordem de desenho por pixel (0 = primeiro, 254 = último, 255 = vazio)
  wordmark.png      "Julia Avila"
  beauty-studio.png "BEAUTY STUDIO"
  julia.jpg         retrato recortado e tratado
  logo.json         posições de cada peça no sistema de coordenadas da logo original
uso: python3 -I prep.py
"""
import json
from collections import deque

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

BG = np.array([24, 33, 66], float)        # azul-marinho medido na logo
GOLD = np.array([214, 160, 115], float)   # dourado médio medido na logo

src = np.asarray(Image.open('assets/logo-original.jpg').convert('RGB')).astype(float)
alpha = np.clip((src[:, :, 0] - src[:, :, 2] + 30) / 130, 0, 1)


def extract(x0, y0, x1, y1, mask=None):
    a = alpha[y0:y1, x0:x1].copy()
    if mask is not None:
        a *= mask
    px = src[y0:y1, x0:x1]
    safe = np.maximum(a, 1e-3)[..., None]
    col = (px - (1 - a[..., None]) * BG) / safe
    col = np.where(a[..., None] > 0.3, col, GOLD)
    rgba = np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8)
    return rgba, a


# ---------- rosto + mapa de ordem do traço ----------
FX0, FY0, FX1, FY1 = 500, 750, 800, 1162
face_rgba, fa = extract(FX0, FY0, FX1, FY1)
H, W = fa.shape
solid = fa > 0.15
label = -np.ones((H, W), int)
comps = []
for y in range(H):
    for x in range(W):
        if solid[y, x] and label[y, x] < 0:
            q, pts = deque([(y, x)]), []
            label[y, x] = len(comps)
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and solid[ny, nx] and label[ny, nx] < 0:
                            label[ny, nx] = len(comps)
                            q.append((ny, nx))
            comps.append(np.array(pts))


def comp_at(x, y):
    """Componente que contém (ou está mais perto de) um ponto em coordenadas da logo."""
    best, bd = None, 1e9
    for i, p in enumerate(comps):
        if len(p) < 15:
            continue
        d = np.min((p[:, 1] + FX0 - x) ** 2 + (p[:, 0] + FY0 - y) ** 2)
        if d < bd:
            best, bd = i, d
    return best


# traços na ordem do desenho: (ponto de referência, início, fim da janela, ponto de partida)
STROKES = [
    ((560, 860), 0.00, 0.24, 'top'),     # testa → nariz
    ((550, 960), 0.18, 0.56, 'top'),     # lábios → queixo → mandíbula → pescoço
    ((620, 886), 0.46, 0.62, 'left'),    # cílios
    ((640, 860), 0.50, 0.92, 'top'),     # contorno externo do cabelo
    ((713, 920), 0.70, 0.76, 'top'),     # início da linha interna
    ((725, 1000), 0.74, 1.00, 'top'),    # linha interna do cabelo
]
order = np.full((H, W), 2.0)
for (rx, ry), s, e, start in STROKES:
    ci = comp_at(rx, ry)
    pts = comps[ci]
    k = pts[:, 0].argmin() if start == 'top' else pts[:, 1].argmin()
    sy, sx = pts[k]
    dist = {(sy, sx): 0}
    q = deque([(sy, sx)])
    while q:
        cy, cx = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                n = (cy + dy, cx + dx)
                if n not in dist and 0 <= n[0] < H and 0 <= n[1] < W and label[n] == ci:
                    dist[n] = dist[(cy, cx)] + 1
                    q.append(n)
    dmax = max(dist.values()) or 1
    for (y, x), d in dist.items():
        order[y, x] = s + (e - s) * d / dmax
# fragmentos soltos e bordas antialias herdam a ordem do vizinho
leftover = [i for i, p in enumerate(comps) if order[tuple(p[0])] > 1.5]
for i in leftover:  # resíduos de JPEG (< 12 px) somem; pedaços reais entram no fim
    for y, x in comps[i]:
        if len(comps[i]) < 12:
            fa[y, x] = 0
        else:
            order[y, x] = 1.0
for _ in range(3):
    pad = np.pad(order, 1, constant_values=2.0)
    neigh = np.min([pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)], axis=0)
    order = np.where((order > 1.5) & (fa > 0.005), neigh, order)
face_rgba[..., 3] = np.where(order > 1.5, 0, face_rgba[..., 3])
order_img = np.where(order > 1.5, 255, np.round(np.clip(order, 0, 1) * 254)).astype(np.uint8)
Image.fromarray(face_rgba, 'RGBA').save('assets/face.png', optimize=True)
Image.fromarray(order_img, 'L').save('assets/face-order.png', optimize=True)

# ---------- wordmark e "BEAUTY STUDIO" ----------
WX0, WY0, WX1, WY1 = 240, 1120, 1000, 1402
BX0, BY0, BX1, BY1 = 400, 1336, 900, 1398
wm_mask = np.ones((WY1 - WY0, WX1 - WX0))
wm_mask[BY0 - WY0:BY1 - WY0, BX0 - WX0:BX1 - WX0] = 0
wm_mask[:1166 - WY0, 600 - WX0:760 - WX0] = 0  # ponta do traço do rosto que invade o recorte
wm, _ = extract(WX0, WY0, WX1, WY1, wm_mask)
bs, _ = extract(BX0, BY0, BX1, BY1)
Image.fromarray(wm, 'RGBA').save('assets/wordmark.png', optimize=True)
Image.fromarray(bs, 'RGBA').save('assets/beauty-studio.png', optimize=True)

json.dump({
    'logoCenter': [645, 1077],
    'face': [FX0, FY0, FX1 - FX0, FY1 - FY0],
    'wordmark': [WX0, WY0, WX1 - WX0, WY1 - WY0],
    'beauty': [BX0, BY0, BX1 - BX0, BY1 - BY0],
}, open('assets/logo.json', 'w'), indent=1)

# ---------- retrato: recorte de rosto, sem o celular, tratamento editorial ----------
ph = Image.open('assets/julia-original.jpg').convert('RGB')
cx, cy, r = 482, 612, 312
ph = ph.crop((cx - r, cy - r, cx + r, cy + r))
ph = ImageEnhance.Color(ph).enhance(0.86)
ph = ImageEnhance.Contrast(ph).enhance(1.06)
arr = np.asarray(ph).astype(float) / 255
# leve aquecimento nos médios e sombras puxadas para o azul da marca
lum = arr.mean(2, keepdims=True)
warm = np.array([1.03, 1.0, 0.95])
navy = BG / 255
arr = arr * warm
arr = arr * (0.9 + 0.1 * lum) + navy * (1 - lum) ** 3 * 0.18
# vinheta suave: o fundo do banheiro some nas bordas
yy, xx = np.mgrid[-1:1:arr.shape[0] * 1j, -1:1:arr.shape[1] * 1j]
v = np.clip(1 - 0.32 * np.clip(np.hypot(xx, yy) - 0.45, 0, 1) ** 1.6, 0, 1)[..., None]
arr = arr * v + navy * (1 - v) * 0.6
out = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
out.save('assets/julia.jpg', quality=92)
print('ok: componentes', len(comps), 'retrato', out.size)
