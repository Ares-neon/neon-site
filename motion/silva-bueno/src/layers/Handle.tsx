import React from 'react';
import {G} from '../lib/geometry';
import {ease, prog} from '../lib/motion';
import {T} from '../timeline';

export const HANDLE = '@silvaebuenoimoveis';
const SIZE = 37; // reference px (~30 px on the final 9:16 frame, ~28 px on 1:1)
const TRACKING = 0.13; // em
const BASELINE = 1036; // ~52 px of air under IMÓVEIS
const LIFT_PX = 12; // screen pixels, as briefed

// Final card: the Instagram handle, minimal sans in silver-white, centred under IMÓVEIS.
export const Handle: React.FC<{frame: number; z: number}> = ({frame, z}) => {
	// Position eases in and out over 0.8 s while opacity reaches 50 % in ~0.17 s: measured on the
	// render, ~10 of the 12 px happen with the handle visible (an expo-out would hide the move).
	const settle = prog(frame, T.handle, ease.soft);
	const opacity = prog(frame, T.handleFade, ease.fadeIn);
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
			visibility={frame < T.handle[0] ? 'hidden' : 'visible'}
			style={{fontKerning: 'normal'}}
		>
			{HANDLE}
		</text>
	);
};
