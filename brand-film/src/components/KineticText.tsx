import React from 'react';
import {FONT_FAMILY, GRID} from '../theme';
import {ease, mix, ramp} from '../lib/ease';

type Props = {
	lines: string[];
	/** Scene-local frame. */
	f: number;
	/** Frame at which the first line starts to rise into its mask. */
	inAt: number;
	/** Frame at which the exit starts. */
	outAt: number;
	align?: 'left' | 'center';
	x?: number;
	/** Distance of the text block's last baseline area from the top of the frame. */
	bottom?: number;
	top?: number;
	size?: number;
	weight?: number;
	tracking?: number;
	stagger?: number;
	color?: string;
	style?: React.CSSProperties;
};

/**
 * Headline typography: each line rises through its own mask (expo-out), while
 * tracking settles from slightly open to its final value. Exit is a short
 * fade with a soft defocus, staggered top to bottom.
 */
export const KineticText: React.FC<Props> = ({
	lines,
	f,
	inAt,
	outAt,
	align = 'left',
	x = GRID.margin,
	bottom = GRID.textBottom,
	top,
	size = GRID.headline,
	weight = 560,
	tracking = 0.012,
	stagger = 7,
	color = '#FFFFFF',
	style,
}) => {
	if (f < inAt - 1 || f > outAt + 40 + lines.length * 3) {
		return null;
	}
	const positional: React.CSSProperties =
		align === 'center'
			? {left: 0, right: 0, textAlign: 'center'}
			: {left: x, right: 60, textAlign: 'left'};
	const vertical: React.CSSProperties = top !== undefined ? {top} : {top: bottom, transform: 'translateY(-100%)'};

	return (
		<div
			style={{
				position: 'absolute',
				...positional,
				...vertical,
				fontFamily: FONT_FAMILY,
				fontSize: size,
				fontWeight: weight,
				fontVariationSettings: "'opsz' 32",
				fontFeatureSettings: "'case' 1, 'kern' 1",
				lineHeight: 1.02,
				color,
				whiteSpace: 'nowrap',
				...style,
			}}
		>
			{lines.map((line, i) => {
				const start = inAt + i * stagger;
				const p = ramp(f, start, start + 46, ease.outExpo);
				const settle = ramp(f, start, start + 80, ease.outCubic);
				const exitStart = outAt + i * 3;
				const q = ramp(f, exitStart, exitStart + 24, ease.inOutSine);
				const opacity = ramp(f, start, start + 16) * (1 - q);
				return (
					<div
						key={i}
						style={{
							overflow: 'hidden',
							padding: '0.2em 0 0.16em',
							margin: '-0.2em 0 -0.16em',
						}}
					>
						<div
							style={{
								transform: `translateY(${mix(132, 0, p) - q * 12}%)`,
								letterSpacing: `${mix(tracking + 0.07, tracking, settle)}em`,
								opacity,
								filter: q > 0.001 ? `blur(${q * 7}px)` : undefined,
							}}
						>
							{line}
						</div>
					</div>
				);
			})}
		</div>
	);
};
