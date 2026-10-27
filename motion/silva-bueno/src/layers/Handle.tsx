import React from 'react';
import {G} from '../lib/geometry';
import {ease, prog} from '../lib/motion';
import {T} from '../timeline';

export const HANDLE = '@silvaebuenoimoveis';
const SIZE = 37; // reference px (~32 px on the 1080-wide master)
const TRACKING = 0.13; // em
const BASELINE = 1036; // ~52 px of air under IMÓVEIS
const LIFT_PX = 12; // screen pixels, as briefed

// Final card: the Instagram handle, minimal sans in silver-white, centred under IMÓVEIS.
export const Handle: React.FC<{frame: number; z: number}> = ({frame, z}) => {
	const settle = prog(frame, T.handle, ease.settle);
	const opacity = prog(frame, T.handle, ease.soft);
	const ls = SIZE * TRACKING;
	return (
		<text
			x={G.axisX + ls / 2} // letter-spacing trails the last glyph; re-centre optically
			y={BASELINE + ((1 - settle) * LIFT_PX) / z}
			textAnchor="middle"
			fontFamily="Montserrat"
			fontWeight={400}
			fontSize={SIZE}
			letterSpacing={ls}
			fill="url(#g-handle)"
			opacity={opacity}
			style={{fontKerning: 'normal'}}
		>
			{HANDLE}
		</text>
	);
};
