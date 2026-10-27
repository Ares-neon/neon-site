import {monotone} from './lib/motion';

export type Format = '9x16' | '1x1';

type Key = readonly [frame: number, cx: number, cy: number, zoom: number];

// Camera = which reference point sits at the frame centre, and at what scale.
// Scenes 1–3 frame the architecture; scene 4 reframes for the signature; scene 5 is a
// near-imperceptible push-in that stops at 13.87 s so the final 1.13 s are truly static.
const AXIS = 633.3;
const FINAL_CY = 624.5; // centre of mark + signature + handle

const KEYS: Record<Format, Key[]> = {
	'9x16': [
		[0, AXIS, 712, 1.085],
		[120, AXIS, 690, 1.11],
		[300, AXIS, 560, 1.215],
		[450, AXIS, 474, 1.25],
		[484, AXIS, 470, 1.252],
		[580, AXIS, FINAL_CY, 0.8],
		[832, AXIS, FINAL_CY, 0.8 * 1.012],
		[900, AXIS, FINAL_CY, 0.8 * 1.012],
	],
	'1x1': [
		[0, AXIS, 642, 0.975],
		[120, AXIS, 620, 0.995],
		[300, AXIS, 545, 1.075],
		[450, AXIS, 470, 1.115],
		[484, AXIS, 467, 1.117],
		[580, AXIS, FINAL_CY, 0.76],
		[832, AXIS, FINAL_CY, 0.76 * 1.012],
		[900, AXIS, FINAL_CY, 0.76 * 1.012],
	],
};

export function camera(format: Format, frame: number) {
	const keys = KEYS[format];
	const cx = monotone(
		keys.map((k) => [k[0], k[1]] as const),
		frame,
	);
	const cy = monotone(
		keys.map((k) => [k[0], k[2]] as const),
		frame,
	);
	// zoom is interpolated in log space so scale changes feel uniform
	const z = Math.exp(
		monotone(
			keys.map((k) => [k[0], Math.log(k[3])] as const),
			frame,
		),
	);
	return {cx, cy, z};
}
