import {loadFont} from '@remotion/fonts';
import React, {useEffect, useState} from 'react';
import {
	AbsoluteFill,
	cancelRender,
	continueRender,
	delayRender,
	Html5Audio,
	Img,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {camera, type Format} from './camera';
import {T} from './timeline';
import {ALL_IDS, textureUrl} from './lib/geometry';
import {Architecture} from './layers/Architecture';
import {Construction} from './layers/Construction';
import {Handle} from './layers/Handle';
import {Light} from './layers/Light';
import {Ring} from './layers/Ring';
import {RoofAndWindow} from './layers/RoofAndWindow';
import {Signature} from './layers/Signature';

loadFont({family: 'Montserrat', url: staticFile('fonts/montserrat-latin-400-normal.woff2'), weight: '400'});

// Decode every texture before the first frame so no element can ever miss a frame.
const decoded: HTMLImageElement[] = [];
const useTextures = () => {
	const [handle] = useState(() => delayRender('Decoding logo textures'));
	useEffect(() => {
		Promise.all(
			ALL_IDS.map((id) => {
				const img = new Image();
				img.src = textureUrl(id);
				decoded.push(img);
				return img.decode();
			}),
		)
			.then(() => continueRender(handle))
			.catch((err) => cancelRender(err));
	}, [handle]);
};

// Filter/mask regions in reference px. Kept tight: software rasterisation cost scales with area.
const box = (x0: number, y0: number, x1: number, y1: number) => ({x: x0, y: y0, width: x1 - x0, height: y1 - y0});
export const REGIONS = {
	symbol: box(60, 180, 1215, 790),
	all: box(60, 180, 1215, 1078),
	pour: box(262, 498, 1006, 900),
	ring: box(350, 215, 890, 765),
	imoveis: box(0, 840, 1254, 1010),
	lines: box(190, 170, 1080, 760),
};

export const SilvaBueno: React.FC<{format: Format}> = ({format}) => {
	useTextures();
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const {cx, cy, z} = camera(format, frame);
	const cam = `translate(${width / 2} ${height / 2}) scale(${z.toFixed(6)}) translate(${(-cx).toFixed(4)} ${(-cy).toFixed(4)})`;

	return (
		<AbsoluteFill style={{backgroundColor: '#0B1E33'}}>
			<Img src={staticFile(`bg/bg-${format}.png`)} style={{width, height}} />
			<Html5Audio src={staticFile('audio/signature.wav')} />
			<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: 'absolute', inset: 0}}>
				<defs>
					{/* contact shadow + soft key shadow: depth without turning the mark into 3D */}
					<filter
						id="f-shadow"
						filterUnits="userSpaceOnUse"
						{...(frame < T.name.start ? REGIONS.symbol : REGIONS.all)}
						colorInterpolationFilters="sRGB"
					>
						<feGaussianBlur in="SourceAlpha" stdDeviation={4.5} result="b1" />
						<feOffset in="b1" dx={1.6} dy={5} result="o1" />
						<feFlood floodColor="#010711" floodOpacity={0.62} />
						<feComposite in2="o1" operator="in" result="s1" />
						<feGaussianBlur in="SourceAlpha" stdDeviation={1.2} result="b2" />
						<feOffset in="b2" dx={0.6} dy={1.6} result="o2" />
						<feFlood floodColor="#000308" floodOpacity={0.5} />
						<feComposite in2="o2" operator="in" result="s2" />
						<feMerge>
							<feMergeNode in="s1" />
							<feMergeNode in="s2" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
					<filter id="f-feather-pour" filterUnits="userSpaceOnUse" {...REGIONS.pour}>
						<feGaussianBlur stdDeviation={2.2} />
					</filter>
					<filter id="f-feather-ring" filterUnits="userSpaceOnUse" {...REGIONS.ring}>
						<feGaussianBlur stdDeviation={2.2} />
					</filter>
					<filter id="f-feather-wide" filterUnits="userSpaceOnUse" {...REGIONS.imoveis}>
						<feGaussianBlur stdDeviation={16} />
					</filter>
					<filter id="f-line-glow" filterUnits="userSpaceOnUse" {...REGIONS.lines}>
						<feGaussianBlur stdDeviation={2.4} />
					</filter>
					<linearGradient id="g-handle" x1={0} y1={0} x2={0} y2={1}>
						<stop offset={0} stopColor="#F7F7F7" />
						<stop offset={1} stopColor="#D3D6DB" />
					</linearGradient>
				</defs>
				<g transform={cam}>
					<g filter="url(#f-shadow)">
						<Construction frame={frame} />
						<RoofAndWindow frame={frame} />
						<Architecture frame={frame} />
						<Ring frame={frame} />
						<Signature frame={frame} />
						<Handle frame={frame} z={z} />
					</g>
					<Light frame={frame} />
				</g>
			</svg>
		</AbsoluteFill>
	);
};
