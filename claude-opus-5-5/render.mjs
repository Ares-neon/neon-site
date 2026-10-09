// Deterministic frame renderer for claude-opus-5-5.html (Playwright + GSAP seek).
//
//   node render.mjs check                         timeline/cue/safe-area report (+ cues.json)
//   node render.mjs stills 0.5,3.4,6.2 [out]      PNG stills at given times (seconds)
//   node render.mjs frames [out] [workers]        every frame at 60 fps → out/f00000.png …
//
// Each frame is produced by window.__seek(t), which seeks the paused master timeline
// and redraws every canvas from state, so frames can be rendered in any order and in
// parallel. Existing frames are skipped, so an interrupted render resumes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(HERE, 'claude-opus-5-5.html');
let pw;
try { pw = await import('playwright'); } catch { pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const { chromium } = pw;

const [, , mode = 'check', a1, a2] = process.argv;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.error(`[${m.type()}]`, m.text()); });
  await page.goto('file://' + HTML + '?render');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp };
}

async function capture({ page, cdp }, t, file) {
  await page.evaluate((t) => new Promise((res) => { window.__seek(t); requestAnimationFrame(() => res()); }), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, fromSurface: true });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
}

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
try {
  if (mode === 'check') {
    const ctx = await openPage(browser);
    const info = await ctx.page.evaluate(() => {
      const f = window.__film;
      const SAFE = { l: 96, r: 984, t: 280, b: 1640 };
      const boxes = [...document.querySelectorAll('#type .t')].map((el) => {
        let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
        el.querySelectorAll('.ln').forEach((ln) => {
          const q = ln.getBoundingClientRect();
          const fs = parseFloat(getComputedStyle(el).fontSize);
          l = Math.min(l, q.left); r = Math.max(r, q.right);
          t = Math.min(t, q.top + 0.136 * fs); b = Math.max(b, q.top + 0.864 * fs);   // cap-height box
        });
        return { id: el.id, l: Math.round(l), r: Math.round(r), t: Math.round(t), b: Math.round(b),
          ok: l >= SAFE.l && r <= SAFE.r && t >= SAFE.t && b <= SAFE.b };
      });
      return { duration: window.__duration, cues: f.cues, issues: f.issues, boxes, labels: f.labels };
    });
    console.log('duration', info.duration, 'labels', JSON.stringify(info.labels));
    console.log('chain issues:', info.issues.length ? '\n  ' + info.issues.join('\n  ') : 'none');
    console.log('type boxes (cap height, px):');
    for (const b of info.boxes) console.log(`  ${b.ok ? 'ok ' : 'OUT'} ${b.id.padEnd(10)} x ${b.l}–${b.r}  y ${b.t}–${b.b}`);
    console.log('cues:', info.cues.length);
    fs.writeFileSync(path.join(HERE, 'audio', 'cues.json'), JSON.stringify({ duration: info.duration, fps: 60, cues: info.cues }, null, 1));
    console.log('wrote audio/cues.json');
  } else if (mode === 'stills') {
    const times = (a1 || '0').split(',').map(Number);
    const out = path.resolve(a2 || path.join(HERE, 'stills'));
    fs.mkdirSync(out, { recursive: true });
    const ctx = await openPage(browser);
    for (const t of times) {
      const f = path.join(out, `t${t.toFixed(3).padStart(6, '0')}.png`);
      await capture(ctx, t, f);
      console.log('still', f);
    }
  } else if (mode === 'frames') {
    const out = path.resolve(a1 || path.join(HERE, 'frames'));
    const workers = Math.max(1, +(a2 || 3));
    fs.mkdirSync(out, { recursive: true });
    const ctx0 = await openPage(browser);
    const { duration, fps } = await ctx0.page.evaluate(() => ({ duration: window.__duration, fps: window.__film.fps }));
    const total = Math.round(duration * fps);
    const todo = [];
    for (let i = 0; i < total; i++) {
      const f = path.join(out, `f${String(i).padStart(5, '0')}.png`);
      if (!fs.existsSync(f) || fs.statSync(f).size === 0) todo.push(i);
    }
    console.log(`frames: ${total} total, ${todo.length} to render, ${workers} workers`);
    const ctxs = [ctx0];
    for (let w = 1; w < workers; w++) ctxs.push(await openPage(browser));
    let next = 0, done = 0;
    const t0 = Date.now();
    await Promise.all(ctxs.map(async (ctx) => {
      while (next < todo.length) {
        const i = todo[next++];
        const f = path.join(out, `f${String(i).padStart(5, '0')}.png`);
        await capture(ctx, i / fps, f + '.tmp');
        fs.renameSync(f + '.tmp', f);
        done++;
        if (done % 60 === 0 || done === todo.length) {
          const el = (Date.now() - t0) / 1000;
          console.log(`  ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((todo.length - done) * el / done).toFixed(0)} s`);
        }
      }
    }));
  } else {
    console.error('unknown mode', mode); process.exitCode = 2;
  }
} finally {
  await browser.close();
}
