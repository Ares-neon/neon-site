"""Gera julia-avila-reels-15s.html com todos os assets embutidos (arquivo único, funciona via file://)."""
import base64
import re

MIME = {'png': 'image/png', 'jpg': 'image/jpeg'}
src = open('src.html', encoding='utf-8').read()


def inline(m):
    path = m.group(0)
    data = base64.b64encode(open(path, 'rb').read()).decode()
    return f"data:{MIME[path.rsplit('.', 1)[1]]};base64,{data}"


out = re.sub(r'assets/(?:face|face-order|wordmark|beauty-studio|julia)\.(?:png|jpg)', inline, src)
open('julia-avila-reels-15s.html', 'w', encoding='utf-8').write(out)
print('julia-avila-reels-15s.html', len(out) // 1024, 'KB')
