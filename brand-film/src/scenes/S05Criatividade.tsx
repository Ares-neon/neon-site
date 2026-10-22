import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {KineticText} from '../components/KineticText';
import {GLSL_COMMON} from '../gl/common';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import type {SceneProps} from './types';

// A monumental curved surface (the limb of a huge sphere) emerges from black.
// Back light draws its edge; a green light travels slowly along the curve.
const FRAG = `${GLSL_COMMON}
uniform vec2 uC;
uniform float uRad;
uniform float uRoll;
uniform float uZoom;
uniform float uGreenA;
uniform float uGreenI;
uniform float uLight;
uniform float uBack;

void main() {
	vec2 px = pixelCoord();
	vec2 c0 = vec2(540.0, 960.0);
	vec2 q = px - c0;
	float cr = cos(uRoll), sr = sin(uRoll);
	q = mat2(cr, -sr, sr, cr) * q / uZoom;
	px = q + c0;

	vec2 d = (px - uC) / uRad;
	float rr = length(d);
	vec2 dir = d / max(rr, 1e-4);
	vec2 dirUp = vec2(dir.x, -dir.y);
	vec3 L1 = normalize(vec3(0.62, 0.62, uBack));
	float facing = max(dot(dirUp, normalize(L1.xy)), 0.0);
	float ang = atan(d.y, d.x);
	float da = ang - uGreenA;
	// comet: sharp head, long soft tail behind (towards smaller angles)
	// Tail along the limb (angular), head as a point light (radial glow).
	float tail = da < 0.0 ? exp(da / 0.22) : exp(-da / 0.010);
	float w = tail * 0.6;
	vec2 pg = uC + uRad * vec2(cos(uGreenA), sin(uGreenA));
	float dg = length(px - pg);
	float headGlow = exp(-dg / 7.0) * 2.2 + exp(-dg / 45.0) * 0.22 + exp(-dg / 220.0) * 0.035;
	vec3 green = srgb2lin(vec3(0.0, 230.0, 59.0) / 255.0);
	vec3 col = vec3(0.0);

	if (rr < 1.0) {
		vec3 N = vec3(dirUp * rr, sqrt(1.0 - rr * rr));
		float din = (1.0 - rr) * uRad;          // px inside the limb
		vec3 L2 = normalize(vec3(0.25, 0.75, 0.6));
		float diff = max(dot(N, L2), 0.0);
		float tex = fbm(d * 30.0, 4);
		float body = (0.0018 + 0.0022 * tex) * diff + 0.0025 * exp(-din / 260.0) * facing;
		col += vec3(body) * uLight;
		float rim = exp(-din / 3.2) * 1.4 + exp(-din / 22.0) * 0.16 + exp(-din / 120.0) * 0.025;
		col += vec3(rim * facing * uLight);
		float gr = exp(-din / 3.0) * 3.2 + exp(-din / 18.0) * 0.22;
		col += green * (gr * w + headGlow * 0.8) * uGreenI;
	} else {
		float dist = (rr - 1.0) * uRad;
		col += vec3(exp(-dist / 2.5) * 0.45 + exp(-dist / 26.0) * 0.045 + exp(-dist / 160.0) * 0.008) * facing * uLight;
		col += green * ((exp(-dist / 3.0) * 1.5 + exp(-dist / 18.0) * 0.16) * w + headGlow) * uGreenI;
	}
	outColor = vec4(finalize(col), 1.0);
}`;

export const S05Criatividade: React.FC<SceneProps> = ({f}) => {
	const m = meta('S05');
	const t = ramp(f, 0, 196, ease.inOutSine);
	const exit = ramp(f, 160, 196, ease.inOut);
	const uniforms = {
		uC: [mix(-330, -380, t), mix(2380, 2330, t)],
		uRad: 1900,
		uRoll: mix(-0.05, 0.035, t),
		uZoom: mix(1.0, 1.07, ramp(f, 0, 196, ease.camera)),
		uGreenA: mix(-1.52, -0.66, ramp(f, 26, 176, ease.inOutSine)),
		uGreenI: ramp(f, 26, 60, ease.inOutSine) * (1 - 0.6 * exit),
		uLight: ramp(f, 0, 64, ease.inOutSine) * (1 - exit),
		uBack: mix(-0.95, -0.5, ramp(f, 0, 120, ease.inOutSine)),
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#050505'}}>
			<ShaderCanvas frag={FRAG} uniforms={uniforms} />
			<KineticText lines={m.lines} f={f} inAt={30} outAt={140} top={250} />
		</AbsoluteFill>
	);
};
