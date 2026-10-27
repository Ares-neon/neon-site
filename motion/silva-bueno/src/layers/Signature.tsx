import React from 'react';
import {E, G, IMV_IDS, NAME_IDS} from '../lib/geometry';
import {ease, lerp, phase, prog} from '../lib/motion';
import {T, type Range} from '../timeline';
import {LogoImage} from './LogoImage';

const RISE = 18; // reference px — "movimento mínimo"
const TRACK_NAME = 0.03; // letters start 3 % wider and settle into the original spacing
const TRACK_IMV = -0.06; // IMÓVEIS opens outwards with its rules
const IMV_HALF = 640; // final half-width of the reveal: > 6 sigma past the rule tips, so dropping the mask is seamless

const nameRange = (id: string): Range => {
	const start = T.name.start + Math.abs(E[id].cx - G.axisX) * T.name.perUnit;
	return [start, start + T.name.dur];
};

// Scene 04: SILVA & BUENO through vertical masks, opening from the ampersand outwards along the
// symmetry axis; then IMÓVEIS + rules from the same centre.
export const Signature: React.FC<{frame: number}> = ({frame}) => {
	const imvPhase = phase(frame, T.imoveis);
	const imvTrack = prog(frame, T.imoveis, ease.settle);
	const imvHalf = prog(frame, T.imoveis, ease.inOut) * IMV_HALF;
	const imvTop = G.imoveis.top - 24;
	const imvH = G.imoveis.bottom - G.imoveis.top + 48;
	return (
		<>
			<defs>
				{NAME_IDS.map((id) => {
					const range = nameRange(id);
					if (phase(frame, range) !== 'during') {
						return null;
					}
					const [x0, y0, x1, y1] = E[id].bbox;
					const wipe = prog(frame, [range[0], range[0] + T.name.dur * 0.8], ease.soft);
					const feather = (y1 - y0) * 0.45;
					const front = lerp(y1 + RISE + feather / 2 + 3, y0 - feather / 2 - 3, wipe);
					return (
						<React.Fragment key={id}>
							<linearGradient
								id={`g-wipe-${id}`}
								gradientUnits="userSpaceOnUse"
								x1={0}
								y1={front - feather / 2}
								x2={0}
								y2={front + feather / 2}
							>
								<stop offset={0} stopColor="#000" />
								<stop offset={1} stopColor="#fff" />
							</linearGradient>
							<mask
								id={`m-${id}`}
								maskUnits="userSpaceOnUse"
								x={x0 - 60}
								y={y0 - 60}
								width={x1 - x0 + 120}
								height={y1 - y0 + 120}
							>
								<rect x={x0 - 60} y={y0 - 60} width={x1 - x0 + 120} height={y1 - y0 + 120} fill={`url(#g-wipe-${id})`} />
							</mask>
						</React.Fragment>
					);
				})}
				{imvPhase === 'during' && (
					<mask id="m-imoveis" maskUnits="userSpaceOnUse" x={0} y={imvTop - 50} width={1254} height={imvH + 100}>
						{imvHalf > 0 && (
							<rect
								x={G.axisX - imvHalf}
								y={imvTop}
								width={imvHalf * 2}
								height={imvH}
								fill="#fff"
								filter="url(#f-feather-wide)"
							/>
						)}
					</mask>
				)}
			</defs>

			{NAME_IDS.map((id) => {
				const range = nameRange(id);
				const ph = phase(frame, range);
				const settle = prog(frame, range, ease.settle);
				const dx = (E[id].cx - G.axisX) * TRACK_NAME * (1 - settle);
				const dy = RISE * (1 - settle);
				return (
					<g key={id} mask={ph === 'during' ? `url(#m-${id})` : undefined} visibility={ph === 'before' ? 'hidden' : 'visible'}>
						<g transform={`translate(${dx.toFixed(3)} ${dy.toFixed(3)})`}>
							<LogoImage id={id} />
						</g>
					</g>
				);
			})}

			<g mask={imvPhase === 'during' ? 'url(#m-imoveis)' : undefined} visibility={imvPhase === 'before' ? 'hidden' : 'visible'}>
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
