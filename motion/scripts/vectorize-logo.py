"""Vetoriza o logo oficial NEON (project/uploads/Neon.PNG) em peças SVG animáveis.

Etapas: upscale 4x -> máscaras (verde do símbolo, branco do raio, branco do wordmark)
-> potrace -> caminhos absolutos por peça -> src/brand/logoPaths.ts
Requisitos: pip install pillow numpy ; apt install potrace
"""
import json, re, subprocess, os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '..', 'project', 'uploads', 'Neon.PNG')
WORK = os.path.join(ROOT, 'work'); os.makedirs(WORK, exist_ok=True)
S = 4

im = Image.open(SRC).convert('RGB')
big = im.resize((im.width * S, im.height * S), Image.LANCZOS)
a = np.asarray(big).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
gm = (g > 170) & (g - r > 90) & (g - b > 90)
wm = (r > 215) & (g > 215) & (b > 215)

def region(m, x0, x1, y0, y1):
    o = np.zeros_like(m); o[y0*S:y1*S, x0*S:x1*S] = m[y0*S:y1*S, x0*S:x1*S]; return o

masks = {'hex': region(gm, 150, 560, 250, 800), 'bolt': region(wm, 250, 430, 380, 640), 'word': region(wm, 560, 1400, 380, 640)}
raw = {}
for k, m in masks.items():
    img = Image.fromarray(np.where(m, 0, 255).astype('uint8')).filter(ImageFilter.MedianFilter(5))
    pbm = os.path.join(WORK, f'{k}.pbm'); svg = os.path.join(WORK, f'{k}.svg')
    img.save(pbm)
    subprocess.run(['potrace', '-s', '--flat', '-t', '40', '-a', '1.0', '-O', '0.4', pbm, '-o', svg], check=True)
    raw[k] = re.findall(r'<path d="([^"]+)"', open(svg).read())

def parse(d):
    toks = re.findall(r'[MmLlCcZz]|-?\d+(?:\.\d+)?', d); i = 0; cmd = None; cur = (0, 0); start = (0, 0); subs = []; sub = None
    def num():
        nonlocal i; v = float(toks[i]); i += 1; return v
    while i < len(toks):
        t = toks[i]
        if re.match(r'[MmLlCcZz]', t):
            cmd = t; i += 1
            if cmd in 'Zz':
                sub.append(('Z',)); cur = start; continue
        if cmd in 'Mm':
            x, y = num(), num()
            if cmd == 'm': x += cur[0]; y += cur[1]
            cur = (x, y); start = cur; sub = [('M', x, y)]; subs.append(sub); cmd = 'l' if cmd == 'm' else 'L'
        elif cmd in 'Ll':
            x, y = num(), num()
            if cmd == 'l': x += cur[0]; y += cur[1]
            cur = (x, y); sub.append(('L', x, y))
        elif cmd in 'Cc':
            q = [num() for _ in range(6)]
            if cmd == 'c': q = [q[0]+cur[0], q[1]+cur[1], q[2]+cur[0], q[3]+cur[1], q[4]+cur[0], q[5]+cur[1]]
            cur = (q[4], q[5]); sub.append(('C', *q))
    return subs

H4 = im.height * S * 10  # potrace usa escala 0.1 e y invertido
def tf(x, y): return (x / (10.0 * S), (H4 - y) / (10.0 * S))

def to_abs(sub):
    pts = []; out = []
    for s in sub:
        if s[0] in 'ML':
            x, y = tf(s[1], s[2]); out.append(f'{s[0]}{x:.2f} {y:.2f}'); pts.append((x, y))
        elif s[0] == 'C':
            p = [tf(s[1], s[2]), tf(s[3], s[4]), tf(s[5], s[6])]
            out.append('C' + ' '.join(f'{u:.2f} {v:.2f}' for u, v in p)); pts += [p[2], p[0], p[1]]
        else: out.append('Z')
    return ''.join(out), pts

def area(pts):
    return sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts))) / 2

result = {}
for k, ds in raw.items():
    items = []
    for d in ds:
        for sub in parse(d):
            dd, pts = to_abs(sub); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            items.append({'d': dd, 'bbox': [min(xs), min(ys), max(xs), max(ys)], 'area': area(pts)})
    items.sort(key=lambda it: -(it['bbox'][2]-it['bbox'][0])*(it['bbox'][3]-it['bbox'][1]))
    groups = []
    for it in items:
        parent = None
        for gg in groups:
            bb = gg['bbox']; c = it['bbox']
            if c[0] >= bb[0] and c[1] >= bb[1] and c[2] <= bb[2] and c[3] <= bb[3] and (it['area'] > 0) != (gg['area'] > 0):
                parent = gg; break
        if parent: parent['d'] += it['d']
        else: groups.append(dict(it))
    for gg in groups:
        bb = gg['bbox']; gg['cx'] = round((bb[0]+bb[2])/2, 2); gg['cy'] = round((bb[1]+bb[3])/2, 2); gg['bbox'] = [round(v, 2) for v in bb]
    groups.sort(key=lambda gg: gg['cx'])
    result[k] = [{'d': gg['d'], 'bbox': gg['bbox'], 'cx': gg['cx'], 'cy': gg['cy']} for gg in groups]

ts = '// Gerado por scripts/vectorize-logo.py a partir do logo oficial (project/uploads/Neon.PNG).\n// Coordenadas no espaço de pixels do arquivo original (1536x1024).\n'
ts += 'export type LogoPiece = {d: string; bbox: [number, number, number, number]; cx: number; cy: number};\n'
for k in ['hex', 'bolt', 'word']:
    ts += f'export const {k.upper()}: LogoPiece[] = ' + json.dumps(result[k]) + ';\n'
open(os.path.join(ROOT, 'src', 'brand', 'logoPaths.ts'), 'w').write(ts)
print({k: len(v) for k, v in result.items()})
