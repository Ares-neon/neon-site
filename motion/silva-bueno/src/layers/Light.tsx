import React from 'react';
import {E} from '../lib/geometry';
import {ease, lerp, prog} from '../lib/motion';
import {T, type Range} from '../timeline';

const ANGLE = 22; // degrees from vertical — one light direction for the whole piece

type BandProps = {
	id: string;
	frame: number;
	range: Range;
	from: number;
	to: number;
	yc: number;
	width: number; // width of the bright core
	peak: number; // core intensity (screen)
	shade: number; // how much the metal darkens just around the core (multiply)
	color: string;
	clip: string[];
	fadeBelow?: [number, number];
};

const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v * 255))).toString(16).padStart(2, '0');
const grey = (v: number) => `#${toHex(v)}${toHex(v)}${toHex(v)}`;

// A reflection on polished metal is a bright streak of the light source flanked by the darker
// studio around it. Near-white silver has almost no headroom for brightening alone, so the band
// combines a narrow `screen` core with soft `multiply` shoulders: contrast, not glare.
const Band: React.FC<BandProps> = ({id, frame, range, from, to, yc, width, peak, shade, color, clip, fadeBelow}) => {
	if (frame <= range[0] || frame >= range[1]) {
		return null;
	}
	const x = lerp(from, to, prog(frame, range, ease.glide));
	const core: Array<[number, number]> = [
		[0, 0],
		[0.3, 0.06],
		[0.42, 0.42],
		[0.5, 1],
		[0.58, 0.42],
		[0.7, 0.06],
		[1, 0],
	];
	const shoulders: Array<[number, number]> = [
		[0, 1],
		[0.22, 1 - shade * 0.45],
		[0.38, 1 - shade],
		[0.5, 1],
		[0.62, 1 - shade],
		[0.78, 1 - shade * 0.45],
		[1, 1],
	];
	const shoulderW = width * 2.6;
	const rect = (w: number, fill: string) => (
		<rect x={x - w / 2} y={yc - 900} width={w} height={1800} fill={fill} transform={`rotate(${ANGLE} ${x} ${yc})`} />
	);
	const fade = fadeBelow ? `url(#m-fade-${id})` : undefined;
	return (
		<>
			<defs>
				<linearGradient id={`g-core-${id}`} x1={0} y1={0} x2={1} y2={0}>
					{core.map(([o, a]) => (
						<stop key={o} offset={o} stopColor={color} stopOpacity={a * peak} />
					))}
				</linearGradient>
				<linearGradient id={`g-shade-${id}`} x1={0} y1={0} x2={1} y2={0}>
					{shoulders.map(([o, v]) => (
						<stop key={o} offset={o} stopColor={grey(v)} />
					))}
				</linearGradient>
				<clipPath id={`c-band-${id}`} clipPathUnits="userSpaceOnUse">
					{clip.map((cid) => (
						<path key={cid} d={E[cid].d} clipRule="evenodd" />
					))}
				</clipPath>
				{fadeBelow && (
					<>
						<linearGradient id={`g-fade-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={fadeBelow[0]} x2={0} y2={fadeBelow[1]}>
							<stop offset={0} stopColor="#fff" />
							<stop offset={1} stopColor="#000" />
						</linearGradient>
						<mask id={`m-fade-${id}`} maskUnits="userSpaceOnUse" x={60} y={180} width={1160} height={720}>
							<rect x={60} y={180} width={1160} height={720} fill={`url(#g-fade-${id})`} />
						</mask>
					</>
				)}
			</defs>
			{shade > 0 && (
				<g clipPath={`url(#c-band-${id})`} style={{mixBlendMode: 'multiply'}}>
					<g mask={fade}>{rect(shoulderW, `url(#g-shade-${id})`)}</g>
				</g>
			)}
			<g clipPath={`url(#c-band-${id})`} style={{mixBlendMode: 'screen'}}>
				<g mask={fade}>{rect(width, `url(#g-core-${id})`)}</g>
			</g>
		</>
	);
};

const ARCHITECTURE = ['tower', 'bldL', 'innerL', 'bldR', 'lineR1', 'lineR2', 'bldFR', 'roof', 'win1', 'win2', 'win3', 'win4'];
const SYMBOL = [...ARCHITECTURE, 'arcL', 'arcR'];
const NAME = ['S', 'I', 'L', 'V', 'A', 'amp', 'B', 'U', 'E', 'N', 'O'].map((g) => `name_${g}`);

export const Light: React.FC<{frame: number}> = ({frame}) => (
	<>
		{/* 03 — studio light grazing the metal once the towers stand */}
		<Band id="studio" frame={frame} range={T.studioLight} from={300} to={1000} yc={470} width={300} peak={0.22} shade={0.07} color="#FFFFFF" clip={ARCHITECTURE} />
		{/* 04 — a discreet golden glint on the ampersand */}
		<Band id="amp" frame={frame} range={T.ampGlint} from={520} to={710} yc={808} width={46} peak={0.7} shade={0.06} color="#FFE9B8" clip={['name_amp']} />
		{/* 05 — the single metallic reflection across the mark and the top of the name */}
		<Band id="reflection" frame={frame} range={T.reflection} from={200} to={1100} yc={560} width={120} peak={0.62} shade={0.16} color="#FFF9F0" clip={[...SYMBOL, ...NAME]} fadeBelow={[790, 880]} />
	</>
);
