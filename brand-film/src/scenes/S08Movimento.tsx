import React from 'react';
import {AbsoluteFill} from 'remotion';
import {KineticText} from '../components/KineticText';
import {runnerPaths} from '../components/Runner';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

// Lateral tracking shot: a runner in silhouette against cove light washing up a
// long wall. Cadence is one stride per beat (45 frames) so every footfall
// lands on an eighth note of the score.
export const GROUND_Y = 1440;
const WALL_Y = 1335;
const H_PX = 610;
const CYCLE = 45;
const SPEED = 21; // px per frame at the runner's depth

const BlurDefs: React.FC = () => (
	<defs>
		<filter id="s08-mb" x="-20%" y="-5%" width="140%" height="110%">
			<feGaussianBlur stdDeviation="5 0" />
		</filter>
		<filter id="s08-fg" x="-50%" y="-5%" width="200%" height="110%">
			<feGaussianBlur stdDeviation="28 0" />
		</filter>
		<filter id="s08-soft">
			<feGaussianBlur stdDeviation="1.2" />
		</filter>
		<filter id="s08-refl">
			<feGaussianBlur stdDeviation="5 3" />
		</filter>
		<filter id="s08-glow" x="-10%" y="-400%" width="120%" height="900%">
			<feGaussianBlur stdDeviation="10" />
		</filter>
		<linearGradient id="s08-wall" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stopColor="#050505" />
			<stop offset="0.45" stopColor="#060606" />
			<stop offset="0.74" stopColor="#141414" />
			<stop offset="0.9" stopColor="#3c3c3c" />
			<stop offset="1" stopColor="#6e6e6e" />
		</linearGradient>
		<radialGradient id="s08-pool" cx="0.5" cy="1" r="0.5" gradientTransform="scale(1 1)">
			<stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
			<stop offset="1" stopColor="#ffffff" stopOpacity="0" />
		</radialGradient>
		<linearGradient id="s08-floor" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stopColor="#2a2a2a" />
			<stop offset="0.12" stopColor="#111111" />
			<stop offset="0.5" stopColor="#070707" />
			<stop offset="1" stopColor="#050505" />
		</linearGradient>
		<linearGradient id="s08-reflFade" x1="0" y1={GROUND_Y} x2="0" y2={GROUND_Y + 380} gradientUnits="userSpaceOnUse">
			<stop offset="0" stopColor="white" stopOpacity="0.5" />
			<stop offset="1" stopColor="white" stopOpacity="0" />
		</linearGradient>
		<mask id="s08-reflMask" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920">
			<rect x="0" y={GROUND_Y} width="1080" height="480" fill="url(#s08-reflFade)" />
		</mask>
	</defs>
);

const Body: React.FC<{phase: number; samples: number[]; x: number; fill: string; opacity?: number}> = ({phase, samples, x, fill, opacity = 1}) => (
	<g opacity={opacity}>
		{samples.map((dp, i) => (
			<g key={i} transform={`translate(${x} ${GROUND_Y}) scale(${H_PX})`} opacity={i === (samples.length >> 1) ? 1 : 0.42}>
				{runnerPaths(phase + dp).map((d, j) => (
					<path key={j} d={d} fill={fill} />
				))}
			</g>
		))}
	</g>
);

export const S08Movimento: React.FC<SceneProps> = ({f}) => {
	const m = meta('S08');
	// Right-foot contact on every beat, left foot on every off-beat.
	const phase = (f + 1000 * CYCLE) / CYCLE;
	const shutter = 0.5 / CYCLE;
	const samples = [-2, -1, 0, 1, 2].map((k) => (k * shutter) / 4);
	const light = ramp(f, -10, 22, ease.inOutSine) * (1 - ramp(f, 158, 186, ease.inOutSine));
	const lineOnly = ramp(f, 150, 186, ease.inOutSine);
	const runnerX = mix(440, 520, ramp(f, -10, 190, ease.inOutSine));
	const scroll = (f + 10) * SPEED;
	const zoom = mix(1.0, 1.045, ramp(f, -10, 190, ease.camera));

	// Wall seams (0.72x parallax) and two out-of-focus foreground pillars (2.6x).
	const seamGap = 330;
	const wallShift = (scroll * 0.72) % seamGap;
	const seams = Array.from({length: 6}, (_, i) => 1080 + seamGap - i * seamGap - wallShift + seamGap);
	const pillars = [2200, 4700].map((x0) => x0 - scroll * 2.6);

	// Footfall glow: brightest at each contact, decaying through the stance.
	const contacts = [0, 0.5].map((off) => {
		const q = (((phase + off) % 1) + 1) % 1;
		return {q, k: q < 0.3 ? Math.exp(-q * 9) : 0};
	});

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: ramp(f, -10, 0)}}>
			<svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
				<BlurDefs />
				<g transform={`translate(540 ${GROUND_Y}) scale(${zoom}) translate(-540 ${-GROUND_Y})`}>
					<g opacity={light}>
						<rect x={-100} y={0} width={1280} height={WALL_Y} fill="url(#s08-wall)" />
						{/* light pools of the cove fixtures, scrolling with the wall */}
						{seams.map((x, i) => (
							<ellipse key={`p${i}`} cx={x + seamGap / 2} cy={WALL_Y} rx={260} ry={360} fill="url(#s08-pool)" />
						))}
						<g filter="url(#s08-mb)" opacity={0.55}>
							{seams.map((x, i) => (
								<rect key={i} x={x} y={300} width={3} height={WALL_Y - 300} fill="#000" />
							))}
						</g>
						<rect x={-100} y={WALL_Y} width={1280} height={1920 - WALL_Y} fill="url(#s08-floor)" />
						{/* glossy floor: reflection of the cove light and of the runner */}
						<rect x={-100} y={WALL_Y} width={1280} height={60} fill="#3a3a3a" opacity={0.35} filter="url(#s08-refl)" />
						<g mask="url(#s08-reflMask)" filter="url(#s08-refl)">
							<g transform={`translate(0 ${2 * GROUND_Y}) scale(1 -1)`}>
								<Body phase={phase} samples={[0]} x={runnerX} fill="#000" />
							</g>
						</g>
					</g>
					{/* the green line along the floor */}
					<g>
						<rect x={-100} y={GROUND_Y - 2} width={1280} height={4} fill={COLORS.green} />
						<rect x={-100} y={GROUND_Y - 7} width={1280} height={14} fill={COLORS.green} opacity={0.5} filter="url(#s08-glow)" />
						<rect x={-100} y={GROUND_Y + 6} width={1280} height={40} fill={COLORS.green} opacity={0.12 * (1 - lineOnly)} filter="url(#s08-refl)" />
						{contacts.map((c, i) =>
							c.k > 0.01 ? (
								<ellipse key={i} cx={runnerX + 30 - c.q * 120} cy={GROUND_Y} rx={70} ry={10} fill={COLORS.green} opacity={0.5 * c.k * light} filter="url(#s08-glow)" />
							) : null,
						)}
					</g>
					<g opacity={light}>
						<Body phase={phase} samples={samples} x={runnerX} fill="#030303" />
						{/* rim light from a high back light: the silhouette minus itself shifted down-forward */}
						<mask id="s08-rim" maskUnits="userSpaceOnUse" x="-200" y="0" width="1480" height="1920">
							<Body phase={phase} samples={[0]} x={runnerX} fill="white" />
							<g transform="translate(2.5 3.5)">
								<Body phase={phase} samples={[0]} x={runnerX} fill="black" />
							</g>
						</mask>
						<g mask="url(#s08-rim)" opacity={0.55}>
							<Body phase={phase} samples={[0]} x={runnerX} fill="#d9d9d9" />
						</g>
					</g>
					{pillars.map((x, i) =>
						x > -400 && x < 1500 ? <rect key={i} x={x} y={-100} width={240} height={2200} fill="#020202" filter="url(#s08-fg)" opacity={light} /> : null,
					)}
				</g>
			</svg>
			<KineticText lines={m.lines} f={f} inAt={26} outAt={134} top={250} />
		</AbsoluteFill>
	);
};
