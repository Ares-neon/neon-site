import {staticFile} from 'remotion';
import guides from '../data/guides.json';
import logo from '../data/logo.json';

// All logo geometry is in reference-image pixels (1254 x 1254), traced from the original artwork.
export type Pt = readonly [number, number];

export type LogoElement = {
	id: string;
	gold: boolean;
	x: number;
	y: number;
	w: number;
	h: number;
	bbox: [number, number, number, number];
	cx: number;
	cy: number;
	d: string;
};

export const E = logo.elements as unknown as Record<string, LogoElement>;
export const G = guides;
export const REF_SIZE = logo.width;

export const textureUrl = (id: string) => staticFile(`logo/${id}.png`);
export const ALL_IDS = Object.keys(E);

export const NAME_IDS = ['S', 'I', 'L', 'V', 'A', 'amp', 'B', 'U', 'E', 'N', 'O'].map((g) => `name_${g}`);
export const IMV_IDS = ['I1', 'M', 'O', 'V', 'E', 'I2', 'S'].map((g) => `imv_${g}`);
export const WINDOW_IDS = ['win1', 'win2', 'win3', 'win4'];
export const BUILDING_IDS = ['bldL', 'bldR', 'bldFR'] as const;
export const SYMBOL_IDS = [
	'tower', 'bldL', 'innerL', 'bldR', 'lineR1', 'lineR2', 'bldFR', 'roof', 'arcL', 'arcR', ...WINDOW_IDS,
];

const R = G.roof as unknown as Record<string, Pt>;
export const ROOF = R;

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// Outer edge of the roof as a folding rule: tip -> knee -> apex <- knee <- tip.
const segL1 = dist(R.kneeTopL, R.apex);
const segL2 = dist(R.tipL, R.kneeTopL);
const segR1 = dist(R.apex, R.kneeTopR);
const segR2 = dist(R.kneeTopR, R.tipR);
const angL1 = Math.atan2(R.kneeTopL[1] - R.apex[1], R.apex[0] - R.kneeTopL[0]);
const angL2 = Math.atan2(R.tipL[1] - R.kneeTopL[1], R.kneeTopL[0] - R.tipL[0]);
const angR1 = Math.atan2(R.kneeTopR[1] - R.apex[1], R.kneeTopR[0] - R.apex[0]);
const angR2 = Math.atan2(R.tipR[1] - R.kneeTopR[1], R.tipR[0] - R.kneeTopR[0]);

export const DATUM_HALF_L = segL1 + segL2;
export const DATUM_HALF_R = segR1 + segR2;
export const DATUM_Y = R.tipL[1];

/**
 * The datum folded by `p` (0 = flat line on the eave baseline, 1 = the roof's outer edge).
 * Segment lengths are preserved and the left tip stays on the baseline, so the fold reads
 * as one rigid architectural gesture: the apex climbs the axis while the tips slide in.
 */
export function foldedEdge(p: number): Pt[] {
	const aL1 = angL1 * p;
	const aL2 = angL2 * p;
	const aR1 = angR1 * p;
	const aR2 = angR2 * p;
	const apexX = G.axisX + (R.apex[0] - G.axisX) * Math.min(1, Math.max(0, p));
	const apexY = DATUM_Y - (segL1 * Math.sin(aL1) + segL2 * Math.sin(aL2));
	const kneeL: Pt = [apexX - segL1 * Math.cos(aL1), apexY + segL1 * Math.sin(aL1)];
	const tipL: Pt = [kneeL[0] - segL2 * Math.cos(aL2), kneeL[1] + segL2 * Math.sin(aL2)];
	const kneeR: Pt = [apexX + segR1 * Math.cos(aR1), apexY + segR1 * Math.sin(aR1)];
	const tipR: Pt = [kneeR[0] + segR2 * Math.cos(aR2), kneeR[1] + segR2 * Math.sin(aR2)];
	return [tipL, kneeL, [apexX, apexY], kneeR, tipR];
}

export const pts = (p: ReadonlyArray<Pt>) => p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

const OUTER: Pt[] = [R.tipL, R.kneeTopL, R.apex, R.kneeTopR, R.tipR];

/** Region between the roof's outer edge and the same edge pushed down by `depth`. */
export function pourPolygon(depth: number): string {
	const lift = 6;
	const top: Pt[] = [[R.tipL[0] - 10, R.tipL[1] - lift], ...OUTER.map(([x, y]) => [x, y - lift] as Pt), [R.tipR[0] + 10, R.tipR[1] - lift]];
	const bottom: Pt[] = [[R.tipR[0] + 10, R.tipR[1] + depth], ...[...OUTER].reverse().map(([x, y]) => [x, y + depth] as Pt), [R.tipL[0] - 10, R.tipL[1] + depth]];
	return pts([...top, ...bottom]);
}

/** Everything above the roof's outer edge (lifted into the breathing gap): buildings emerge from it. */
export function aboveRoofPolygon(): string {
	const lift = G.clipLift;
	const edge = OUTER.map(([x, y]) => [x, y - lift] as Pt);
	return pts([[-600, edge[0][1]], ...edge, [1900, edge[4][1]], [1900, -600], [-600, -600]]);
}

/** Clockwise arc (SVG y-down) on the ring's mid radius. */
export function ringPath(fromDeg: number, toDeg: number, r: number): string {
	const {cx, cy} = G.ring;
	const a0 = (fromDeg * Math.PI) / 180;
	const a1 = (toDeg * Math.PI) / 180;
	const large = toDeg - fromDeg > 180 ? 1 : 0;
	return `M${(cx + r * Math.cos(a0)).toFixed(2)},${(cy + r * Math.sin(a0)).toFixed(2)} A${r},${r} 0 ${large} 1 ${(cx + r * Math.cos(a1)).toFixed(2)},${(cy + r * Math.sin(a1)).toFixed(2)}`;
}
