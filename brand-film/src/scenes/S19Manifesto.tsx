import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ease, mix, ramp} from '../lib/ease';
import {BEAT} from '../timeline';
import {COLORS, FONT_FAMILY} from '../theme';
import type {SceneProps} from './types';

// Words land on the beat grid (eighth notes = 22.5 frames) of bar 19.
const LINES: {word: string; at: number}[][] = [
	[
		{word: 'MARCAS', at: 6},
		{word: 'QUE', at: 6 + BEAT * 0.5},
		{word: 'NÃO', at: 6 + BEAT},
	],
	[
		{word: 'PASSAM', at: 6 + BEAT * 2},
		{word: 'DESPERCEBIDAS.', at: 6 + BEAT * 2.5},
	],
];

export const MANIFESTO_LINE_Y = 1078;

export const S19Manifesto: React.FC<SceneProps> = ({f}) => {
	const fadeIn = ramp(f, -20, 0);
	const out = ramp(f, 214, 240, ease.inOutSine);
	const line = ramp(f, 6 + BEAT * 3.5, 6 + BEAT * 4.3, ease.outExpo);
	const push = mix(1.0, 1.03, ramp(f, -20, 260, ease.inOutSine));
	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: fadeIn}}>
			<AbsoluteFill style={{transform: `scale(${push})`}}>
				<div
					style={{
						position: 'absolute',
						left: 0,
						right: 0,
						top: 850,
						textAlign: 'center',
						fontFamily: FONT_FAMILY,
						fontSize: 70,
						fontWeight: 560,
						fontVariationSettings: "'opsz' 32",
						fontFeatureSettings: "'case' 1, 'kern' 1",
						letterSpacing: '0.01em',
						lineHeight: 1.08,
						color: COLORS.white,
						opacity: 1 - out,
						filter: out > 0.001 ? `blur(${out * 8}px)` : undefined,
					}}
				>
					{LINES.map((ln, i) => (
						<div key={i} style={{whiteSpace: 'nowrap'}}>
							{ln.map((w, j) => {
								const p = ramp(f, w.at, w.at + 40, ease.outExpo);
								const o = ramp(f, w.at, w.at + 14);
								return (
									<span key={j} style={{display: 'inline-block', overflow: 'hidden', padding: '0.2em 0 0.14em', margin: '-0.2em 0 -0.14em', verticalAlign: 'top'}}>
										<span
											style={{
												display: 'inline-block',
												transform: `translateY(${mix(118, 0, p)}%)`,
												opacity: o,
												filter: p < 0.98 ? `blur(${(1 - p) * 6}px)` : undefined,
											}}
										>
											{w.word}
										</span>
										{j < ln.length - 1 ? <span style={{display: 'inline-block', width: '0.28em'}} /> : null}
									</span>
								);
							})}
						</div>
					))}
				</div>
				{/* small green line under the manifesto */}
				<div
					style={{
						position: 'absolute',
						left: 540 - 60 * line,
						width: 120 * line,
						top: MANIFESTO_LINE_Y,
						height: 3,
						background: COLORS.green,
						boxShadow: `0 0 14px ${COLORS.green}`,
						opacity: (1 - ramp(f, 236, 250)) * Math.min(1, line * 3),
					}}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
