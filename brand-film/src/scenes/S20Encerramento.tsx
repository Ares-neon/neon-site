import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {DOORWAY_FRAG} from '../gl/doorway';
import {ease, mix, ramp} from '../lib/ease';
import {COLORS, RGB} from '../theme';
import {MANIFESTO_LINE_Y} from './S19Manifesto';
import type {SceneProps} from './types';

// Bookend of scene 01: the green underline of the manifesto turns upright and
// becomes a slit of green light in the same dark room. Then the light fades
// and the film ends in black and silence.
const toLinear = (c: number) => Math.pow(c, 2.2);
const GREEN_LIN = [toLinear(RGB.green[0]), toLinear(RGB.green[1]), toLinear(RGB.green[2])];
// Doorway geometry (see gl/doorway.ts): base 1330 px, height 730 px, centre x 540.
const SLIT_TOP = 600;
const SLIT_BASE = 1330;

export const S20Encerramento: React.FC<SceneProps> = ({f}) => {
	const turn = ramp(f, -20, 14, ease.inOut);
	const angle = 90 * turn;
	const len = mix(120, SLIT_BASE - SLIT_TOP, ramp(f, -12, 20, ease.inOut));
	const cy = mix(MANIFESTO_LINE_Y + 1.5, (SLIT_TOP + SLIT_BASE) / 2, ramp(f, -16, 18, ease.inOut));
	const svgLine = ramp(f, -20, -14) * (1 - ramp(f, 12, 30));
	const room = ramp(f, 6, 30, ease.inOutSine);
	const dim = 1 - ramp(f, 54, 100, ease.inOutSine);
	const uniforms = {
		uLineH: 1,
		uWidth: mix(0.004, 0.05, ramp(f, 18, 60, ease.inOut)),
		uBright: 1.35 * room * dim,
		uZoom: mix(1.06, 1.0, ramp(f, -20, 120, ease.camera)),
		uDrift: 0,
		uBloom: 1.2,
		uExposure: 1,
		uColor: GREEN_LIN,
	};
	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black}}>
			{room > 0.001 ? <ShaderCanvas frag={DOORWAY_FRAG} uniforms={uniforms} style={{opacity: room}} /> : null}
			{svgLine > 0.001 ? (
				<svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
					<defs>
						<filter id="s20-glow" x="-200%" y="-50%" width="500%" height="200%">
							<feGaussianBlur stdDeviation="6" />
						</filter>
					</defs>
					<g transform={`translate(540 ${cy}) rotate(${angle})`} opacity={svgLine}>
						<rect x={-len / 2} y={-1.5} width={len} height={3} fill={COLORS.green} />
						<rect x={-len / 2} y={-6} width={len} height={12} fill={COLORS.green} opacity={0.6} filter="url(#s20-glow)" />
					</g>
				</svg>
			) : null}
		</AbsoluteFill>
	);
};
