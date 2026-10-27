#!/usr/bin/env node
// Fast preview loop: render a frame range small and sparse, tile it into one contact sheet.
// Usage: node scripts/preview.mjs <fromFrame> <toFrame> [--every 6] [--scale 0.3] [--cols 6]
//        [--comp SilvaBueno-9x16] [--frames 10,20,30] [--out renders/previews]
import {bundle} from '@remotion/bundler';
import {openBrowser, renderFrames, renderStill, selectComposition} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdirSync, readdirSync, renameSync, rmSync} from 'node:fs';
import path from 'node:path';

const a = process.argv.slice(2);
const opt = (k, d) => {
	const i = a.indexOf('--' + k);
	return i >= 0 ? a[i + 1] : d;
};
const from = parseInt(a[0] ?? '0', 10);
const to = parseInt(a[1] ?? '899', 10);
const every = parseInt(opt('every', '6'), 10);
const scale = parseFloat(opt('scale', '0.3'));
const cols = parseInt(opt('cols', '6'), 10);
const compId = opt('comp', 'SilvaBueno-9x16');
const outDir = opt('out', 'renders/previews');
const only = opt('frames', null)
	?.split(',')
	.map((n) => parseInt(n, 10));
const browserExecutable = process.env.REMOTION_BROWSER ?? null;

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tag = `${compId}_${from}-${to}${only ? '_picked' : ''}`;
const framesDir = path.join(root, 'cache/preview', tag);
rmSync(framesDir, {recursive: true, force: true});
mkdirSync(framesDir, {recursive: true});
mkdirSync(path.join(root, outDir), {recursive: true});

const t0 = Date.now();
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public')});
const browser = await openBrowser('chrome', {browserExecutable, chromiumOptions: {gl: 'swangle'}});
const composition = await selectComposition({serveUrl, id: compId, puppeteerInstance: browser});
let n = 0;
if (only) {
	for (const f of only) {
		await renderStill({
			composition,
			serveUrl,
			puppeteerInstance: browser,
			frame: f,
			imageFormat: 'jpeg',
			jpegQuality: 90,
			scale,
			output: path.join(framesDir, `f${String(f).padStart(4, '0')}.jpg`),
			overwrite: true,
		});
		n++;
	}
} else {
	// one pass, several tabs, every Nth frame of the range
	await renderFrames({
		composition,
		serveUrl,
		puppeteerInstance: browser,
		frameRange: [from, to],
		everyNthFrame: every,
		imageFormat: 'jpeg',
		jpegQuality: 90,
		scale,
		concurrency: 4,
		outputDir: framesDir,
		imageSequencePattern: 'f[frame].[ext]',
		onStart: () => {},
		onFrameUpdate: () => {},
	});
	// the sequence pattern numbers frames by output index; map back to composition frames
	const produced = readdirSync(framesDir)
		.map((file) => ({file, m: file.match(/^f(\d+)\.jpe?g$/)}))
		.filter((x) => x.m)
		.sort((x, y) => parseInt(x.m[1], 10) - parseInt(y.m[1], 10));
	const tmp = produced.map(({file}, i) => {
		const t = path.join(framesDir, `tmp_${i}.jpg`);
		renameSync(path.join(framesDir, file), t);
		return t;
	});
	tmp.forEach((t, i) => {
		const fr = from + i * every;
		renameSync(t, path.join(framesDir, `f${String(fr).padStart(4, '0')}.jpg`));
		n++;
	});
}
await browser.close({silent: true});
const sheet = path.join(root, outDir, `sheet_${tag}.jpg`);
const r = spawnSync('python3', [path.join(root, 'scripts/contact_sheet.py'), framesDir, sheet, String(cols)], {stdio: 'inherit'});
if (r.status !== 0) {
	console.error('contact sheet failed');
	process.exit(1);
}
console.log(`${n} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
