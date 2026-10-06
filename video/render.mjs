// Renderiza neon-reels-15s.html quadro a quadro (Playwright + GSAP seek).
// uso: node render.mjs neon-reels-15s.html frames frames 60
//      ffmpeg -framerate 60 -i frames/f%04d.png -c:v libx264 -crf 14 -pix_fmt yuv420p -movflags +faststart neon-reels-15s.mp4
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, htmlPath, outDir, mode = 'frames', fps = '30', times = ''] = process.argv;
const CACHE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '.cache'); fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(outDir, { recursive: true });
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
function fetchCached(url) {
  const f = path.join(CACHE, crypto.createHash('md5').update(url).digest('hex'));
  if (!fs.existsSync(f + '.ok')) {
    let ok = false;
    for (let a = 0; a < 8 && !ok; a++) {
      try { execFileSync('curl', ['-sSLf', '--max-time', '20', '--retry', '3', '--retry-all-errors', '-A', UA, '-o', f, '-D', f + '.h', url]); ok = true; } catch (e) {}
    }
    if (!ok) throw new Error('curl failed');
    fs.writeFileSync(f + '.ok', '');
  }
  const h = fs.readFileSync(f + '.h', 'utf8');
  const ct = (h.match(/content-type:\s*([^\r\n]+)/ig) || []).pop()?.split(':').slice(1).join(':').trim() || 'application/octet-stream';
  return { body: fs.readFileSync(f), contentType: ct };
}
// pré-carrega dependências externas (HTML + CSS do Google Fonts) antes de abrir o browser
{
  const html = fs.readFileSync(htmlPath, 'utf8');
  const urls = new Set(html.match(/https:\/\/(cdnjs|cdn\.fontshare|fonts\.googleapis)[^"')\s]+/g).map(u => u.replace(/&amp;/g, "&")).filter(u => /css2|\.js$|\.woff2$/.test(u)));
  for (const u of [...urls]) {
    const r = fetchCached(u);
    if (/css/.test(r.contentType)) (r.body.toString().match(/https:\/\/[^)'"]+/g) || []).forEach(x => urls.add(x));
  }
  for (const u of urls) fetchCached(u);
  console.log('cached', urls.size);
}
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, userAgent: UA });
await page.route(/^https:\/\//, async route => {
  try { const u = route.request().url(); const f = path.join(CACHE, crypto.createHash('md5').update(u).digest('hex')); if (!fs.existsSync(f + '.ok')) throw new Error('not cached'); const r = fetchCached(u); await route.fulfill({ status: 200, body: r.body, contentType: r.contentType, headers: { 'access-control-allow-origin': '*' } }); }
  catch (e) { console.error('fetch fail', route.request().url()); await route.abort(); }
});
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto('file://' + path.resolve(htmlPath) + '?render');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const list = mode === 'frames'
  ? Array.from({ length: 15 * +fps }, (_, i) => i / +fps)
  : times.split(',').map(Number);
let i = 0;
for (const t of list) {
  await page.evaluate(t => window.__seek(t), t);
  const name = mode === 'frames' ? `f${String(i).padStart(4, '0')}.png` : `t${t.toFixed(2)}.png`;
  await page.screenshot({ path: path.join(outDir, name), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  i++;
}
await browser.close();
console.log('done', list.length);
