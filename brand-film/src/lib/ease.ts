import {Easing, interpolate} from 'remotion';

/** Custom curves. Camera moves use long decelerations; reveals use expo-out. */
export const ease = {
	outExpo: Easing.bezier(0.16, 1, 0.3, 1),
	outQuart: Easing.bezier(0.25, 1, 0.5, 1),
	outCubic: Easing.bezier(0.33, 1, 0.68, 1),
	inCubic: Easing.bezier(0.32, 0, 0.67, 0),
	inQuad: Easing.bezier(0.11, 0, 0.5, 0),
	inOut: Easing.bezier(0.65, 0, 0.35, 1),
	inOutSine: Easing.bezier(0.37, 0, 0.63, 1),
	camera: Easing.bezier(0.42, 0.0, 0.18, 1),
	linear: (t: number) => t,
};

export type EaseFn = (t: number) => number;

/** 0..1 progress of `f` between frames a and b, eased and clamped. */
export const ramp = (f: number, a: number, b: number, fn: EaseFn = ease.linear) =>
	interpolate(f, [a, b], [0, 1], {easing: fn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Smooth 0..1 window: rises a→b, holds, falls c→d. */
export const window4 = (f: number, a: number, b: number, c: number, d: number, fn: EaseFn = ease.inOutSine) =>
	ramp(f, a, b, fn) * (1 - ramp(f, c, d, fn));

export const smoothstep = (e0: number, e1: number, x: number) => {
	const t = clamp01((x - e0) / (e1 - e0));
	return t * t * (3 - 2 * t);
};
