import React from 'react';
import {G, ringPath} from '../lib/geometry';
import {ease, phase, prog} from '../lib/motion';
import {T} from '../timeline';
import {LogoImage} from './LogoImage';

const R_MID = (G.ring.rMin + G.ring.rMax) / 2;
const BRUSH = G.ring.rMax - G.ring.rMin + 28;
const PATH = ringPath(G.ring.startDeg - 4, G.ring.endDeg + 4, R_MID);

// Scene 03: the golden ring is drawn in one continuous stroke — lower-left, over the top
// (behind the tower), down to the lower-right — enclosing the architecture.
export const Ring: React.FC<{frame: number}> = ({frame}) => {
	const ph = phase(frame, T.ring);
	const q = prog(frame, T.ring, ease.draw);
	return (
		<>
			{ph === 'during' && (
				<defs>
					<mask id="m-ring" maskUnits="userSpaceOnUse" x={350} y={215} width={540} height={550}>
						{q > 0 && (
							<path
								d={PATH}
								fill="none"
								stroke="#fff"
								strokeWidth={BRUSH}
								pathLength={1}
								strokeDasharray={`${q.toFixed(5)} 2`}
								filter="url(#f-feather-ring)"
							/>
						)}
					</mask>
				</defs>
			)}
			<g mask={ph === 'during' ? 'url(#m-ring)' : undefined} visibility={ph === 'before' ? 'hidden' : 'visible'}>
				<LogoImage id="arcL" />
				<LogoImage id="arcR" />
			</g>
		</>
	);
};
