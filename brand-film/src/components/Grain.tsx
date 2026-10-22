import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ShaderCanvas} from './ShaderCanvas';

// Two-scale film grain (fine pixel grain + ~2px clumps), seeded by the frame
// number. The pattern changes at 30 Hz (every second frame), like film grain
// at 24-30 fps, which also keeps the H.264 bitrate in check. Blended with
// `overlay`.
const FRAG = `
uniform float uSeed;
uniform float uAmount;
float h(vec3 p) {
	p = fract(p * vec3(0.1031, 0.1030, 0.0973));
	p += dot(p, p.yxz + 33.33);
	return fract((p.x + p.y) * p.z);
}
float vnoise(vec2 p, float s) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = h(vec3(i, s)), b = h(vec3(i + vec2(1.0, 0.0), s));
	float c = h(vec3(i + vec2(0.0, 1.0), s)), d = h(vec3(i + vec2(1.0, 1.0), s));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
	vec2 px = vUv * uRes;
	float fine = h(vec3(floor(px), uSeed)) + h(vec3(floor(px) + 17.0, uSeed + 3.1)) - 1.0;
	float clump = vnoise(px / 2.2, uSeed * 1.37) * 2.0 - 1.0;
	float n = fine * 0.55 + clump * 0.75;
	outColor = vec4(vec3(0.5 + n * uAmount), 1.0);
}`;

export const Grain: React.FC<{amount?: number; opacity?: number}> = ({amount = 0.5, opacity = 0.17}) => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill style={{mixBlendMode: 'overlay', opacity, pointerEvents: 'none', zIndex: 101}}>
			<ShaderCanvas frag={FRAG} uniforms={{uSeed: (Math.floor(frame / 2) % 997) + 1.0, uAmount: amount}} />
		</AbsoluteFill>
	);
};

/** Soft optical vignette. */
export const Vignette: React.FC<{strength?: number}> = ({strength = 0.55}) => (
	<AbsoluteFill
		style={{
			pointerEvents: 'none',
			zIndex: 100,
			background: `radial-gradient(ellipse 78% 62% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength * 0.55}) 82%, rgba(0,0,0,${strength}) 100%)`,
		}}
	/>
);
