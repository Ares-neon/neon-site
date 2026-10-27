import React from 'react';
import {pourPolygon, WINDOW_IDS} from '../lib/geometry';
import {ease, phase, prog} from '../lib/motion';
import {T} from '../timeline';
import {LogoImage} from './LogoImage';

const MAX_DEPTH = 162; // edge -> bottom of the window, plus feather

// Scene 02: gold pours down from the folded edge — first the roof, then (same front) the window.
export const RoofAndWindow: React.FC<{frame: number}> = ({frame}) => {
	const ph = phase(frame, T.pour);
	const depth = prog(frame, T.pour, ease.pour) * MAX_DEPTH;
	return (
		<>
			{ph === 'during' && (
				<defs>
					<mask id="m-pour" maskUnits="userSpaceOnUse" x={262} y={498} width={744} height={402}>
						{depth > 0 && <polygon points={pourPolygon(depth)} fill="#fff" filter="url(#f-feather-pour)" />}
					</mask>
				</defs>
			)}
			<g mask={ph === 'during' ? 'url(#m-pour)' : undefined} visibility={ph === 'before' ? 'hidden' : 'visible'}>
				<LogoImage id="roof" />
				{WINDOW_IDS.map((id) => (
					<LogoImage key={id} id={id} />
				))}
			</g>
		</>
	);
};
