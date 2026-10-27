// QA: for every frame, verify that every revealed element stays inside the frame with a margin.
import {camera, type Format} from '../src/camera';
import {E, G, NAME_IDS} from '../src/lib/geometry';
import {T} from '../src/timeline';

const formats: Array<[Format, number, number]> = [
	['9x16', 1080, 1920],
	['1x1', 1080, 1080],
];
const MARGIN = 36;
for (const [fmt, W, H] of formats) {
	let worst = Infinity;
	let worstAt = '';
	for (let f = 0; f < 900; f++) {
		const {cx, cy, z} = camera(fmt, f);
		const toScreen = (x: number, y: number) => [(x - cx) * z + W / 2, (y - cy) * z + H / 2];
		const visible: string[] = [];
		if (f >= T.fold[0]) visible.push('roof');
		if (f >= T.tower[0]) visible.push('tower', 'bldL', 'bldR', 'bldFR');
		if (f >= T.ring[0]) visible.push('arcL', 'arcR');
		for (const id of NAME_IDS) {
			const start = T.name.start + Math.abs(E[id].cx - G.axisX) * T.name.perUnit;
			if (f >= start) visible.push(id);
		}
		if (f >= T.imoveis[0]) visible.push('ruleL', 'ruleR');
		for (const id of visible) {
			const [x0, y0, x1, y1] = E[id].bbox;
			const [sx0, sy0] = toScreen(x0, y0);
			const [sx1, sy1] = toScreen(x1, y1);
			const m = Math.min(sx0, sy0, W - sx1, H - sy1);
			if (m < worst) {
				worst = m;
				worstAt = `frame ${f} ${id} -> x ${sx0.toFixed(0)}..${sx1.toFixed(0)} y ${sy0.toFixed(0)}..${sy1.toFixed(0)} z=${z.toFixed(3)}`;
			}
		}
		// the construction datum at full length before the fold
		if (f >= T.datum[0] && f < T.fold[1]) {
			const [l] = toScreen(G.axisX - 404, 0);
			const [r] = toScreen(G.axisX + 404, 0);
			const m = Math.min(l, W - r);
			if (m < worst) {
				worst = m;
				worstAt = `frame ${f} datum -> x ${l.toFixed(0)}..${r.toFixed(0)}`;
			}
		}
	}
	console.log(`${fmt}: tightest margin ${worst.toFixed(1)} px at ${worstAt} ${worst < MARGIN ? '  <-- TOO TIGHT' : 'OK'}`);
}
