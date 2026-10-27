import React from 'react';
import {E, G, IMV_IDS, NAME_IDS} from '../lib/geometry';
import {ease, lerp, prog} from '../lib/motion';
import {T} from '../timeline';
import {LogoImage} from './LogoImage';

const RISE = 18; // reference px — "movimento mínimo"
const TRACK_NAME = 0.03; // letters start 3 % wider and settle into the original spacing
const nameStart = (id: string) => T.name.start + Math.abs(E[id].cx - G.axisX) * T.name.perUnit;
const TRACK_IMV = -0.06; // IMÓVEIS opens outwards with its rules

// Scene 04: SILVA & BUENO through vertical masks, opening from the ampersand outwards along the
// symmetry axis; then IMÓVEIS + rules from the same centre.
export const Signature: React.FC<{frame: number}> = ({frame}) => {
	const imvReveal = prog(frame, T.imoveis, ease.inOut);
	const imvTrack = prog(frame, T.imoveis, ease.settle);
	const imvHalf = imvReveal * 575;
	const imvTop = G.imoveis.top - 24;
	const imvH = G.imoveis.bottom - G.imoveis.top + 48;
	return (
		<>
			<defs>
				{NAME_IDS.map((id) => {
					const [x0, y0, x1, y1] = E[id].bbox;
					const start = nameStart(id);
					const wipe = prog(frame, [start, start + T.name.dur * 0.8], ease.soft);
					const feather = (y1 - y0) * 0.45;
					const front = lerp(y1 + RISE + feather / 2 + 3, y0 - feather / 2 - 3, wipe);
					return (
						<React.Fragment key={id}>
							<linearGradient id={`g-wipe-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={front - feather / 2} x2={0} y2={front + feather / 2}>
								<stop offset={0} stopColor="#000" />
								<stop offset={1} stopColor="#fff" />
							</linearGradient>
							<mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={x0 - 60} y={y0 - 60} width={x1 - x0 + 120} height={y1 - y0 + 120}>
								<rect x={x0 - 60} y={y0 - 60} width={x1 - x0 + 120} height={y1 - y0 + 120} fill={`url(#g-wipe-${id})`} />
							</mask>
						</React.Fragment>
					);
				})}
				<mask id="m-imoveis" maskUnits="userSpaceOnUse" x={0} y={imvTop - 50} width={1254} height={imvH + 100}>
					{imvHalf > 0 && (
						<rect x={G.axisX - imvHalf} y={imvTop} width={imvHalf * 2} height={imvH} fill="#fff" filter="url(#f-feather-wide)" />
					)}
				</mask>
			</defs>

			{NAME_IDS.map((id) => {
				const e = E[id];
				const start = nameStart(id);
				const settle = prog(frame, [start, start + T.name.dur], ease.settle);
				const dx = (e.cx - G.axisX) * TRACK_NAME * (1 - settle);
				const dy = RISE * (1 - settle);
				return (
					<g key={id} mask={`url(#m-${id})`}>
						<g transform={`translate(${dx.toFixed(3)} ${dy.toFixed(3)})`}>
							<LogoImage id={id} />
						</g>
					</g>
				);
			})}

			<g mask="url(#m-imoveis)">
				{IMV_IDS.map((id) => {
					const dx = (E[id].cx - G.axisX) * TRACK_IMV * (1 - imvTrack);
					return (
						<g key={id} transform={`translate(${dx.toFixed(3)} 0)`}>
							<LogoImage id={id} />
						</g>
					);
				})}
				<LogoImage id="ruleL" />
				<LogoImage id="ruleR" />
			</g>
		</>
	);
};
