// Render final com motion blur exato:
// 1) renderiza os sub-quadros da composição Sub-<fmt> em blocos;
// 2) faz a média em ponto flutuante (scripts/accumulate.py) -> quadros finais;
// 3) codifica com ffmpeg (com e sem áudio).
// Uso: node scripts/render-film.mjs <16x9|9x16> [--scale=1] [--from=0] [--to=449] [--out=dir] [--keep]
import {bundle} from '@remotion/bundler';
import {renderFrames, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const fmt = args[0] || '16x9';
const opt = Object.fromEntries(args.slice(1).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const scale = Number(opt.scale ?? 1);
const from = Number(opt.from ?? 0);
const to = Number(opt.to ?? 449);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(opt.out || path.join(root, 'work', `frames-${fmt}${scale !== 1 ? `-s${scale}` : ''}`));
const subDir = path.join(root, 'work', `_sub-${fmt}`);
fs.mkdirSync(outDir, {recursive: true});
const chrome = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

console.log('bundle…');
const serveUrl = process.env.BUNDLE || (await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')}));
const composition = await selectComposition({serveUrl, id: `NEON-Subframes-${fmt}`, browserExecutable: chrome});
const schedule = composition.props.schedule;
const CHUNK = 40; // quadros finais por bloco
const t0 = Date.now();
for (let f0 = from; f0 <= to; f0 += CHUNK) {
  const f1 = Math.min(to, f0 + CHUNK - 1);
  const idx = schedule.map((s, i) => [s, i]).filter(([s]) => s[0] >= f0 && s[0] <= f1).map(([, i]) => i);
  const a = idx[0], b = idx[idx.length - 1];
  fs.rmSync(subDir, {recursive: true, force: true});
  fs.mkdirSync(subDir, {recursive: true});
  await renderFrames({
    composition,
    serveUrl,
    outputDir: subDir,
    imageFormat: 'png',
    frameRange: [a, b],
    scale,
    concurrency: 4,
    browserExecutable: chrome,
    onStart: () => {},
    onFrameUpdate: () => {},
  });
  const files = fs.readdirSync(subDir).filter((x) => x.endsWith('.png')).sort();
  const byIndex = new Map(files.map((x) => [Number(x.match(/(\d+)\.png$/)[1]), path.join(subDir, x)]));
  const groups = [];
  for (let f = f0; f <= f1; f++) {
    const inputs = schedule.map((s, i) => [s, i]).filter(([s]) => s[0] === f).map(([, i]) => byIndex.get(i));
    if (inputs.some((x) => !x)) throw new Error(`faltando sub-quadros do frame ${f}`);
    groups.push({out: path.join(outDir, `f${String(f).padStart(4, '0')}.png`), inputs});
  }
  const manifest = path.join(subDir, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({groups, linear: false, delete: true}));
  execFileSync('python3', [path.join(root, 'scripts/accumulate.py'), manifest]);
  const el = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`frames ${f0}-${f1} ok (${b - a + 1} sub-quadros) · ${el}s`);
}
fs.rmSync(subDir, {recursive: true, force: true});
console.log('pronto:', outDir);
