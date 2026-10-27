import {Easing, interpolate} from 'remotion';
import type {Range} from '../timeline';

// One easing family for the whole piece: long, decelerating tails; no bounce.
export const ease = {
	inOut: Easing.bezier(0.65, 0, 0.35, 1),
	draw: Easing.bezier(0.55, 0, 0.18, 1), // decisive start, long settle (line work)
	settle: Easing.bezier(0.16, 1, 0.3, 1), // expo-like arrival
	rise: Easing.bezier(0.3, 0.75, 0.2, 1), // vertical structures: inertia, soft landing
	fold: Easing.bezier(0.5, -0.12, 0.22, 1), // discreet anticipation before the fold
	pour: Easing.bezier(0.45, 0, 0.12, 1),
	soft: Easing.bezier(0.4, 0, 0.2, 1),
	glide: Easing.bezier(0.42, 0, 0.58, 1), // light sweeps
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Eased progress of `frame` through `range` (clamped to 0..1 before easing). */
export const prog = (frame: number, range: Range, easing: (t: number) => number = ease.inOut) =>
	interpolate(frame, range as unknown as number[], [0, 1], {
		easing,
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Monotone cubic (Steffen) interpolation through keyframes, zero slope at both ends.
 * Gives C1-continuous camera moves: no micro-stops between keyframes, no overshoot.
 */
export function monotone(keys: ReadonlyArray<readonly [number, number]>, x: number): number {
	const n = keys.length;
	if (x <= keys[0][0]) return keys[0][1];
	if (x >= keys[n - 1][0]) return keys[n - 1][1];
	const h: number[] = [];
	const d: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		h.push(keys[i + 1][0] - keys[i][0]);
		d.push((keys[i + 1][1] - keys[i][1]) / h[i]);
	}
	const m: number[] = [0];
	for (let i = 1; i < n - 1; i++) {
		if (d[i - 1] * d[i] <= 0) {
			m.push(0);
		} else {
			const p = (d[i - 1] * h[i] + d[i] * h[i - 1]) / (h[i - 1] + h[i]);
			m.push(
				(Math.sign(d[i - 1]) + Math.sign(d[i])) *
					Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p)),
			);
		}
	}
	m.push(0);
	let i = 0;
	while (x > keys[i + 1][0]) i++;
	const t = (x - keys[i][0]) / h[i];
	const t2 = t * t;
	const t3 = t2 * t;
	return (
		(2 * t3 - 3 * t2 + 1) * keys[i][1] +
		(t3 - 2 * t2 + t) * h[i] * m[i] +
		(-2 * t3 + 3 * t2) * keys[i + 1][1] +
		(t3 - t2) * h[i] * m[i + 1]
	);
}
