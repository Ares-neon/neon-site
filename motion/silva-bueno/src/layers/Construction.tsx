import React from 'react';
import {DATUM_HALF_L, DATUM_HALF_R, DATUM_Y, E, foldedEdge, G, pts, type Pt} from '../lib/geometry';
import {ease, prog} from '../lib/motion';
import {T} from '../timeline';

export const LINE_GOLD = '#EBC06A';
const AXIS_TOP = E.tower.bbox[1];

// Scenes 01–03: the single gesture. A datum line grows from the centre, the axis is born
// from it, the datum folds into the roof's outer edge and finally hands over to the metal.
export const Construction: React.FC<{frame: number}> = ({frame}) => {
	if (frame < T.datum[0] || frame > T.axisHandOver[1]) {
		return null;
	}
	const grow = prog(frame, T.datum, ease.draw);
	const appear = prog(frame, [T.datum[0], T.datum[0] + 14], ease.soft);
	const fold = prog(frame, T.fold, ease.fold);
	const edgeAlpha = 1 - prog(frame, T.edgeHandOver, ease.soft);
	const axisGrow = prog(frame, T.axis, ease.draw);
	const axisAlpha = 1 - prog(frame, T.axisHandOver, ease.soft);
	const ticks = prog(frame, T.datumTicks, ease.soft) * (1 - prog(frame, T.ticksOut, ease.soft));

	const edge: Pt[] =
		frame < T.fold[0]
			? [
					[G.axisX - DATUM_HALF_L * grow, DATUM_Y],
					[G.axisX + DATUM_HALF_R * grow, DATUM_Y],
				]
			: foldedEdge(fold);
	const apex = frame < T.fold[0] ? ([G.axisX, DATUM_Y] as Pt) : edge[2];
	const axisTop = DATUM_Y + (AXIS_TOP - DATUM_Y) * axisGrow;
	const tipL = edge[0];
	const tipR = edge[edge.length - 1];
	const topTick = prog(frame, [T.axis[1] - 10, T.axis[1] + 8], ease.soft) * axisAlpha;

	const hair = {vectorEffect: 'non-scaling-stroke' as const, fill: 'none', strokeLinecap: 'round' as const};
	const lines = (w: number) => (
		<>
			{edgeAlpha > 0 && (
				<polyline
					points={pts(edge)}
					stroke={LINE_GOLD}
					strokeWidth={w}
					strokeLinejoin="miter"
					opacity={appear * edgeAlpha}
					style={hair}
				/>
			)}
			{axisGrow > 0 && axisAlpha > 0 && (
				<line
					x1={apex[0]}
					y1={apex[1]}
					x2={apex[0]}
					y2={Math.min(axisTop, apex[1])}
					stroke={LINE_GOLD}
					strokeWidth={w * 0.85}
					opacity={axisAlpha}
					style={hair}
				/>
			)}
		</>
	);

	return (
		<g>
			{/* soft light around the hairlines */}
			<g filter="url(#f-line-glow)" opacity={0.55}>
				{lines(5)}
			</g>
			{lines(1.8)}
			{ticks > 0 && (
				<g stroke={LINE_GOLD} opacity={ticks * 0.75} style={hair} strokeWidth={1.2}>
					<line x1={tipL[0]} y1={tipL[1] - 9} x2={tipL[0]} y2={tipL[1] + 9} />
					<line x1={tipR[0]} y1={tipR[1] - 9} x2={tipR[0]} y2={tipR[1] + 9} />
				</g>
			)}
			{topTick > 0 && (
				<line
					x1={apex[0] - 9}
					y1={AXIS_TOP}
					x2={apex[0] + 9}
					y2={AXIS_TOP}
					stroke={LINE_GOLD}
					strokeWidth={1.2}
					opacity={topTick * 0.75}
					style={hair}
				/>
			)}
		</g>
	);
};
