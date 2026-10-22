export const FPS = 60;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION = 3600; // 60 s

export const COLORS = {
	black: '#050505',
	white: '#FFFFFF',
	green: '#00E63B',
} as const;

/** Brand colours as 0..1 sRGB triplets for shaders. */
export const RGB = {
	black: [5 / 255, 5 / 255, 5 / 255],
	white: [1, 1, 1],
	green: [0, 230 / 255, 59 / 255],
} as const;

export const FONT_FAMILY = 'Inter Neon';

/** Typographic grid (px, 1080x1920 canvas). */
export const GRID = {
	margin: 96,
	textBottom: 1480,
	headline: 86,
	manifesto: 76,
} as const;
