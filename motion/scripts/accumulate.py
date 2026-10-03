"""Média em ponto flutuante dos sub-quadros (motion blur exato).
Uso: python3 accumulate.py <manifest.json>
manifest: {"groups": [{"out": "path.png", "inputs": ["a.png", ...]}], "linear": false, "delete": true}
"""
import json, sys, os
import numpy as np
from PIL import Image

def to_lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)

def to_srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, None), 1 / 2.4) - 0.055)

m = json.load(open(sys.argv[1]))
linear = m.get('linear', False)
for g in m['groups']:
    acc = None
    for p in g['inputs']:
        a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64) / 255.0
        if linear:
            a = to_lin(a)
        acc = a if acc is None else acc + a
    acc /= len(g['inputs'])
    if linear:
        acc = to_srgb(acc)
    out = np.clip(np.round(acc * 255.0), 0, 255).astype(np.uint8)
    Image.fromarray(out).save(g['out'], compress_level=1)
    if m.get('delete'):
        for p in g['inputs']:
            if p != g['out']:
                try: os.remove(p)
                except OSError: pass
print('ok', len(m['groups']))
