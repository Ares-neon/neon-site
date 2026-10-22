import React from 'react';
import {AbsoluteFill} from 'remotion';
import {SYMBOL_BOX, SymbolPaths, WORDMARK_BOX, WordmarkPaths} from '../components/NeonLogo';
import {ease, mix, ramp} from '../lib/ease';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

// Stacked lockup as in the storyboard. Symbol and wordmark share one scale,
// so their proportions are those of the original lockup.
const S = 0.95;
const SYM_W = (SYMBOL_BOX[2] - SYMBOL_BOX[0]) * S;
const SYM_H = (SYMBOL_BOX[3] - SYMBOL_BOX[1]) * S;
const WORD_W = (WORDMARK_BOX[2] - WORDMARK_BOX[0]) * S;
export const SYMBOL_CENTER_Y = 840;
const SYM_X = 540 - SYM_W / 2;
const SYM_Y = SYMBOL_CENTER_Y - SYM_H / 2;
const GAP = 80;
const WORD_X = 540 - WORD_W / 2;
const WORD_Y = SYM_Y + SYM_H + GAP;

const hexagon = (cx: number, cy: number, r: number, rot: number) => {
	const pts: string[] = [];
	for (let i = 0; i < 6; i++) {
		const a = rot + (Math.PI / 3) * i - Math.PI / 2;
		pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
	}
	return pts.join(' ');
};

export const S18Marca: React.FC<SceneProps> = ({f}) => {
	// 1. the horizon line of scene 17 contracts to the width of the mark
	const lineW = mix(1180, SYM_W * 0.9, ramp(f, -14, 16, ease.inOut));
	const lineO = ramp(f, -14, -4) * (1 - ramp(f, 10, 30, ease.inOutSine));
	// 2. a hexagonal aperture opens from the centre of the symbol
	const open = ramp(f, 6, 84, ease.inOut);
	const hexR = mix(0, 330, open);
	const hexRot = mix(0.55, 0, ramp(f, 8, 80, ease.outCubic));
	const edge = ramp(f, 6, 20) * (1 - ramp(f, 50, 86, ease.inOutSine));
	// 3. soft light settles on the symbol, then the wordmark is unveiled
	const glow = ramp(f, 40, 110, ease.inOutSine);
	const word = ramp(f, 82, 136, ease.outExpo);
	const sweep = ramp(f, 96, 156, ease.inOut);
	const push = mix(1.0, 1.035, ramp(f, -14, 200, ease.inOutSine));
	const out = 1 - ramp(f, 176, 200, ease.inOutSine);
	const cy = SYMBOL_CENTER_Y;

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: out}}>
			<svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
				<defs>
					<filter id="s18-glow" x="-60%" y="-60%" width="220%" height="220%">
						<feGaussianBlur stdDeviation="22" />
					</filter>
					<radialGradient id="s18-atmo">
						<stop offset="0" stopColor={COLORS.green} stopOpacity="1" />
						<stop offset="0.4" stopColor={COLORS.green} stopOpacity="0.6" />
						<stop offset="0.75" stopColor={COLORS.green} stopOpacity="0.15" />
						<stop offset="1" stopColor={COLORS.green} stopOpacity="0" />
					</radialGradient>
					<filter id="s18-soft" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="3" />
					</filter>
					<mask id="s18-hex" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
						<polygon points={hexagon(540, cy, hexR, hexRot)} fill="white" />
					</mask>
					<linearGradient id="s18-wordGrad" gradientUnits="userSpaceOnUse" x1={540 - (WORD_W / 2 + 60) * word} y1="0" x2={540 + (WORD_W / 2 + 60) * word} y2="0">
						<stop offset="0" stopColor="white" stopOpacity="0" />
						<stop offset="0.08" stopColor="white" stopOpacity="1" />
						<stop offset="0.92" stopColor="white" stopOpacity="1" />
						<stop offset="1" stopColor="white" stopOpacity="0" />
					</linearGradient>
					<mask id="s18-word" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
						<rect x="0" y="0" width="1080" height="1920" fill="url(#s18-wordGrad)" />
					</mask>
					<linearGradient id="s18-sweep" gradientUnits="userSpaceOnUse" x1={mix(WORD_X - 260, WORD_X + WORD_W + 60, sweep)} y1="0" x2={mix(WORD_X - 60, WORD_X + WORD_W + 260, sweep)} y2="0">
						<stop offset="0" stopColor="white" stopOpacity="0" />
						<stop offset="0.5" stopColor="white" stopOpacity="1" />
						<stop offset="1" stopColor="white" stopOpacity="0" />
					</linearGradient>
					<mask id="s18-sweepMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
						<rect x="0" y="0" width="1080" height="1920" fill="url(#s18-sweep)" />
					</mask>
				</defs>
				<g transform={`translate(540 960) scale(${push}) translate(-540 -960)`}>
					{/* faint green atmosphere behind the symbol */}
					<ellipse cx={540} cy={cy} rx={440} ry={520} fill="url(#s18-atmo)" opacity={0.10 * glow} />
					<g mask="url(#s18-hex)">
						<g transform={`translate(${SYM_X} ${SYM_Y}) scale(${S})`}>
							<g opacity={0.5 * glow} filter="url(#s18-glow)">
								<SymbolPaths />
							</g>
							<SymbolPaths />
						</g>
					</g>
					<polygon points={hexagon(540, cy, hexR, hexRot)} fill="none" stroke="white" strokeWidth={1.5} opacity={0.45 * edge} />
					<polygon points={hexagon(540, cy, hexR, hexRot)} fill="none" stroke={COLORS.green} strokeWidth={8} opacity={0.3 * edge} filter="url(#s18-soft)" />
					<g mask="url(#s18-word)">
						<g transform={`translate(${WORD_X} ${WORD_Y}) scale(${S}) translate(${-WORDMARK_BOX[0]} ${-WORDMARK_BOX[1]})`}>
							<WordmarkPaths />
						</g>
					</g>
					<g mask="url(#s18-sweepMask)" opacity={0.45 * (1 - ramp(f, 140, 160))}>
						<g transform={`translate(${WORD_X} ${WORD_Y}) scale(${S}) translate(${-WORDMARK_BOX[0]} ${-WORDMARK_BOX[1]})`} filter="url(#s18-soft)">
							<WordmarkPaths />
						</g>
					</g>
					{lineO > 0.001 ? (
						<g opacity={lineO}>
							<rect x={540 - lineW / 2} y={cy - 1.5} width={lineW} height={3} fill={COLORS.green} />
							<rect x={540 - lineW / 2} y={cy - 8} width={lineW} height={16} fill={COLORS.green} opacity={0.5} filter="url(#s18-soft)" />
						</g>
					) : null}
				</g>
			</svg>
		</AbsoluteFill>
	);
};
