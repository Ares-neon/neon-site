// Deterministic frame renderer: headless Chromium → PNG frames.
// usage: node tools/render.cjs --out <dir> [--scale 1] [--from 0] [--to 899] [--step 1] [--workers 4] [--frames 0,15,30]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '..');
const scale = +arg('scale', 1), out = path.resolve(arg('out', path.join(ROOT, 'build/frames')));
const workers = +arg('workers', 4);
let frames = arg('frames') ? arg('frames').split(',').map(Number) : [];
if (!frames.length) for (let f = +arg('from', 0); f <= +arg('to', 899); f += +arg('step', 1)) frames.push(f);
fs.mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); } });
}).listen(0, async () => {
  const port = srv.address().port, W = Math.round(1080 * scale), H = Math.round(1920 * scale);
  const b = await chromium.launch({ args: ['--disable-gpu-vsync', '--font-render-hinting=none'] });
  const t0 = Date.now(); let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    p.on('pageerror', e => console.error('pageerror', e.message));
    p.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
    await p.goto(`http://127.0.0.1:${port}/src/film.html?scale=${scale}`);
    await p.evaluate(() => window.FILM.ready);
    for (let i = w; i < frames.length; i += workers) {
      const f = frames[i];
      await p.evaluate(f => window.FILM.render(f), f);
      await p.screenshot({ path: path.join(out, `f${String(f).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: W, height: H } });
      if (++done % 50 === 0) console.log(`${done}/${frames.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await p.close();
  }));
  await b.close(); srv.close();
  console.log(`done ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out}`);
});
