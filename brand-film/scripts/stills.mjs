// Render individual frames of the film for inspection.
//   node scripts/stills.mjs 0 60 120          -> out/stills/f0000.png ...
//   node scripts/stills.mjs 0-180:30          -> every 30th frame of 0..180
//   SCALE=0.5 node scripts/stills.mjs ...     -> half resolution
//   COMP=S01-Abertura node scripts/stills.mjs ...
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const frames = [];
for (const a of args) {
	const m = a.match(/^(\d+)-(\d+)(?::(\d+))?$/);
	if (m) {
		const step = Number(m[3] ?? 1);
		for (let f = Number(m[1]); f <= Number(m[2]); f += step) frames.push(f);
	} else {
		frames.push(Number(a));
	}
}
if (frames.length === 0) {
	console.error('usage: node scripts/stills.mjs <frame|a-b[:step]> ...');
	process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'out', 'stills');
fs.mkdirSync(outDir, {recursive: true});
const scale = Number(process.env.SCALE ?? 1);
const compId = process.env.COMP ?? 'NeonBrandFilm';
const chromiumOptions = {gl: process.env.GL ?? 'swangle'};

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts')});
const browser = await openBrowser('chrome', {
	browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE ?? null,
	chromiumOptions,
});
const composition = await selectComposition({serveUrl, id: compId, puppeteerInstance: browser, chromiumOptions});

for (const frame of frames) {
	const out = path.join(outDir, `${compId === 'NeonBrandFilm' ? 'f' : compId + '-'}${String(frame).padStart(4, '0')}.png`);
	const t0 = Date.now();
	await renderStill({composition, serveUrl, output: out, frame, scale, puppeteerInstance: browser, chromiumOptions, overwrite: true});
	console.log(`${out}  ${Date.now() - t0} ms`);
}
await browser.close({silent: true});
