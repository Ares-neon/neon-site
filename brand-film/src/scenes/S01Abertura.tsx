import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {KineticText} from '../components/KineticText';
import {DOORWAY_FRAG} from '../gl/doorway';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import type {SceneProps} from './types';

export const S01Abertura: React.FC<SceneProps> = ({f}) => {
	const m = meta('S01');
	const lineH = ramp(f, 16, 74, ease.outExpo);
	const open = ramp(f, 70, 154, ease.inOut);
	const uniforms = {
		uLineH: Math.max(lineH, 0.0001),
		uWidth: mix(0.004, 0.48, open),
		uBright: ramp(f, 12, 34) * (0.7 + 0.45 * open),
		uZoom: mix(1.0, 1.11, ramp(f, 0, 194, ease.camera)),
		uDrift: mix(0, -26, ramp(f, 0, 194, ease.inOutSine)),
		uBloom: 1 + 5.5 * ramp(f, 156, 194, ease.inCubic),
		uExposure: 1 + 7.0 * ramp(f, 158, 194, ease.inCubic),
		uColor: [1, 1, 1],
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#050505'}}>
			<ShaderCanvas frag={DOORWAY_FRAG} uniforms={uniforms} />
			<KineticText lines={m.lines} f={f} inAt={62} outAt={148} top={286} />
		</AbsoluteFill>
	);
};
