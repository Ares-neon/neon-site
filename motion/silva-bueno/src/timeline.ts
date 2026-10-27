// Every timing of the piece lives here (frames @ 60 fps). Retime = edit this file.
export const FPS = 60;
export const DURATION = 15 * FPS; // 900

export type Range = readonly [number, number];

export const T = {
	// 01 — THE FOUNDATION (0–2 s): a datum line, then the axis born from it
	datum: [24, 100] as Range,
	datumTicks: [86, 108] as Range,
	axis: [64, 128] as Range,

	// 02 — THE STRUCTURE (2–5 s): the datum folds into the roof, gold pours in
	fold: [122, 206] as Range,
	ticksOut: [122, 150] as Range,
	pour: [198, 290] as Range,
	edgeHandOver: [236, 272] as Range,

	// 03 — THE ARCHITECTURE (5–8 s): towers rise from the roof, the ring encloses
	tower: [298, 372] as Range,
	axisHandOver: [350, 384] as Range,
	bldL: [320, 394] as Range,
	bldR: [332, 406] as Range,
	bldFR: [344, 418] as Range,
	innerL: [384, 424] as Range,
	lineR1: [392, 430] as Range,
	lineR2: [398, 436] as Range,
	ring: [394, 480] as Range,
	studioLight: [436, 530] as Range,

	// 04 — THE SIGNATURE (8–11 s): reframe first (camera 484–580), then the name opens from
	// the ampersand outwards along the axis, the ampersand catches light, IMÓVEIS + rules follow
	name: {start: 546, perUnit: 0.065, dur: 44}, // stagger = distance from the axis x perUnit
	ampGlint: [600, 632] as Range,
	imoveis: [616, 676] as Range,

	// 05 — THE FINAL REVEAL (11–15 s): one metallic reflection, handle, static hold
	reflection: [686, 780] as Range,
	handle: [780, 828] as Range, // 12 px rise
	handleFade: [780, 804] as Range, // opacity leads the rise so the 12 px are actually seen
	holdFrom: 832, // camera stops here: 68 frames (1.13 s) fully static
} as const;
