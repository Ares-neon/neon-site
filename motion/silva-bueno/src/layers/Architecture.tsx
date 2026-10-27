import React from 'react';
import {aboveRoofPolygon, E, G} from '../lib/geometry';
import {ease, prog} from '../lib/motion';
import {T, type Range} from '../timeline';
import {LogoImage} from './LogoImage';

const HIDE = G.hide as Record<string, number>;
const RISING: Array<[string, Range]> = [
	['bldL', T.bldL],
	['bldR', T.bldR],
	['bldFR', T.bldFR],
	['tower', T.tower],
];
const INNER: Array<[string, Range]> = [
	['innerL', T.innerL],
	['lineR1', T.lineR1],
	['lineR2', T.lineR2],
];

// Scene 03: the roof gives birth to the towers (gold first), then the inner lines are drawn.
export const Architecture: React.FC<{frame: number}> = ({frame}) => (
	<>
		<defs>
			<clipPath id="c-above-roof" clipPathUnits="userSpaceOnUse">
				<polygon points={aboveRoofPolygon()} />
			</clipPath>
			{INNER.map(([id, range]) => {
				const [x0, y0, x1, y1] = E[id].bbox;
				const h = (y1 - y0 + 10) * prog(frame, range, ease.draw);
				return (
					<clipPath key={id} id={`c-wipe-${id}`} clipPathUnits="userSpaceOnUse">
						<rect x={x0 - 4} y={y1 + 5 - h} width={x1 - x0 + 8} height={h} />
					</clipPath>
				);
			})}
		</defs>
		<g clipPath="url(#c-above-roof)">
			{RISING.map(([id, range]) => (
				// kept mounted (textures stay decoded) but not painted before the rise:
				// a hidden tower would otherwise leak through the clip edge's anti-aliasing
				<g
					key={id}
					opacity={frame > range[0] ? 1 : 0}
					transform={`translate(0 ${((1 - prog(frame, range, ease.rise)) * HIDE[id]).toFixed(3)})`}
				>
					<LogoImage id={id} />
				</g>
			))}
		</g>
		{INNER.map(([id]) => (
			<g key={id} clipPath={`url(#c-wipe-${id})`}>
				<LogoImage id={id} />
			</g>
		))}
	</>
);
