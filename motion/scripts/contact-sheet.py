"""Contact sheet do filme NEON a partir dos quadros finais (com motion blur).
Uso: python3 scripts/contact-sheet.py <16x9|9x16> <dir_quadros> <saida.png> [passo=15]
Um quadro por batida (120 BPM = 15 frames), com frame, timecode e seção.
"""
import os
import sys

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fmt, frames_dir, out = sys.argv[1], sys.argv[2], sys.argv[3]
step = int(sys.argv[4]) if len(sys.argv) > 4 else 15
portrait = fmt == '9x16'

def font(weight, size):
    ttf = os.path.join(ROOT, 'work', f'Switzer-{weight}.ttf')
    if not os.path.exists(ttf):
        f = TTFont(os.path.join(ROOT, 'public', 'fonts', f'Switzer-{weight}.woff2'))
        f.flavor = None
        os.makedirs(os.path.dirname(ttf), exist_ok=True)
        f.save(ttf)
    return ImageFont.truetype(ttf, size)

SECTIONS = [(0, 45, 'GANCHO'), (45, 120, 'CONSTRUÇÃO'), (120, 210, 'ACELERAÇÃO'), (210, 315, 'PICO'), (315, 375, 'IMPACTO'), (375, 450, 'RESOLUÇÃO')]
def section(f):
    for a, b, n in SECTIONS:
        if a <= f < b:
            return n
    return ''

frames = list(range(0, 450, step)) + [449]
cols = 8 if portrait else 6
tw, th = (240, 427) if portrait else (400, 225)
pad, lab = 14, 34
rows = (len(frames) + cols - 1) // cols
head = 150
W = cols * tw + (cols + 1) * pad
H = head + rows * (th + lab + pad) + pad + 40
sheet = Image.new('RGB', (W, H), (0, 0, 0))
d = ImageDraw.Draw(sheet)
GREEN = (57, 255, 20)
d.text((pad, 34), 'NEON — Branding & Performance', font=font(800, 44), fill=(255, 255, 255))
d.text((pad, 92), f'Filme de marca 15 s · {"9:16 1080×1920" if portrait else "16:9 1920×1080"} · 30 fps · 120 BPM · 1 quadro por batida (motion blur final)', font=font(600, 20), fill=(170, 170, 170))
d.rectangle([W - pad - 18, 40, W - pad, 58], fill=GREEN)
for k, f in enumerate(frames):
    r, c = divmod(k, cols)
    x = pad + c * (tw + pad)
    y = head + r * (th + lab + pad)
    im = Image.open(os.path.join(frames_dir, f'f{f:04d}.png')).convert('RGB').resize((tw, th), Image.LANCZOS)
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + tw - 1, y + th - 1], outline=(40, 40, 40))
    s = f / 30
    tc = f'00:00:{int(s):02d}:{f % 30:02d}'
    d.text((x, y + th + 8), f'{f:03d}', font=font(800, 16), fill=GREEN)
    d.text((x + 44, y + th + 8), f'{tc}  {section(f)}', font=font(600, 14), fill=(200, 200, 200))
d.text((pad, H - 34), '@NEONCREATES', font=font(600, 16), fill=(120, 120, 120))
sheet.save(out, optimize=True)
print(out, sheet.size)
