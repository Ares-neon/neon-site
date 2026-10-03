// Revisão sem assistir: renderiza quadros finais (com motion blur acumulado) e monta folha de contato.
// Uso: node scripts/stills.mjs <16x9|9x16> <frames: 0,10,20 | 0-100:10> [scale] [nome.png]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , fmt = '16x9', spec = '0-449:30', scale = '0.5', outName] = process.argv;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = process.env.STILLS_DIR || path.join(root, 'work', 'stills');
const TMP = path.join(OUT, '_sub');
fs.mkdirSync(TMP, {recursive: true});
const frames = spec.split(',').flatMap((part) => {
  const m = part.match(/^(\d+)-(\d+)(?::(\d+))?$/);
  if (!m) return [Number(part)];
  const out = [];
  for (let f = +m[1]; f <= +m[2]; f += +(m[3] || 1)) out.push(f);
  return out;
});
const chrome = process.env.REMOTION_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const serveUrl = process.env.BUNDLE || (await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')}));
const composition = await selectComposition({serveUrl, id: `NEON-Subframes-${fmt}`, browserExecutable: chrome});
const schedule = composition.props.schedule;
const blur = process.env.NOBLUR ? false : true;
const groups = [];
const files = [];
for (const f of frames) {
  const idx = schedule.map((s, i) => [s, i]).filter(([s]) => s[0] === f).map(([, i]) => i);
  const use = blur ? idx : [idx[Math.floor(idx.length / 2)]];
  const inputs = [];
  for (const i of use) {
    const file = path.join(TMP, `${fmt}-${f}-${i}.png`);
    await renderStill({composition, serveUrl, output: file, frame: i, scale: Number(scale), browserExecutable: chrome, overwrite: true});
    inputs.push(file);
  }
  const out = path.join(OUT, `${fmt}-${String(f).padStart(3, '0')}.png`);
  groups.push({out, inputs});
  files.push(out);
}
const manifest = path.join(TMP, 'manifest.json');
fs.writeFileSync(manifest, JSON.stringify({groups, linear: false, delete: true}));
execFileSync('python3', [path.join(root, 'scripts/accumulate.py'), manifest]);
const sheet = path.join(OUT, outName || `sheet-${fmt}.png`);
const portrait = composition.height > composition.width;
const cols = portrait ? Math.min(files.length, 8) : Math.min(files.length, 5);
execFileSync('montage', [...files, '-background', '#222', '-fill', '#ccc', '-pointsize', '14', '-label', '%t', '-geometry', '+3+3', '-tile', `${cols}x`, sheet]);
console.log(sheet);
