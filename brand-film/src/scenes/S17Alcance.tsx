import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {KineticText} from '../components/KineticText';
import {GLSL_COMMON} from '../gl/common';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import type {SceneProps} from './types';

// The limb of a planet-scale curved surface rising out of black. A thin white
// atmosphere outlines it; a green line runs along the horizon. The camera
// pulls back and the curvature tightens.
const FRAG = `${GLSL_COMMON}
uniform vec2 uC;
uniform float uRad;
uniform float uGreen;     // progress of the green line along the horizon (0..1)
uniform float uGreenI;
uniform float uLight;
uniform float uExposure;
uniform float uLine;      // 0..1: limb flattens into a straight line (exit)

void main() {
	vec2 px = pixelCoord();
	vec2 d = (px - uC) / uRad;
	float rr = length(d);
	vec2 dir = d / max(rr, 1e-5);
	float ang = atan(dir.x, -dir.y);           // 0 at the top of the limb
	float din = (1.0 - rr) * uRad;
	vec3 col = vec3(0.0);
	vec3 green = srgb2lin(vec3(0.0, 230.0, 59.0) / 255.0);
	float topness = smoothstep(-0.2, 1.0, -dir.y);

	if (rr < 1.0) {
		vec3 N = vec3(dir * rr, sqrt(1.0 - rr * rr));
		// Night side with a faint terminator from a sun behind the limb.
		float sun = max(dot(N, normalize(vec3(0.15, -0.9, -0.35))), 0.0);
		vec2 sp = vec2(ang * 3.0, rr * 9.0);
		float clouds = fbm(sp * vec2(4.0, 1.0) + vec2(0.0, 3.0), 5);
		float surf = 0.0045 + 0.010 * clouds * clouds;
		col += vec3(surf * (0.25 + 4.0 * pow(1.0 - rr, 0.5) * 0.0) + sun * 0.05 * clouds) * uLight;
		// Atmosphere seen from inside the limb.
		col += vec3(exp(-din / 10.0) * 0.55 + exp(-din / 70.0) * 0.06) * topness * uLight;
	} else {
		float dout = (rr - 1.0) * uRad;
		col += vec3(exp(-dout / 4.0) * 0.45 + exp(-dout / 40.0) * 0.06 + exp(-dout / 260.0) * 0.012) * topness * uLight;
	}
	// Green line along the horizon, drawn from left to right.
	float span = mix(-1.2, 1.2, uGreen);
	float along = smoothstep(span + 0.02, span - 0.04, ang) * smoothstep(-1.3, -1.1, ang);
	float ld = abs(rr - 1.0) * uRad + 1.5;
	col += green * along * (exp(-ld * ld / 5.0) * 2.2 + exp(-ld / 22.0) * 0.18) * uGreenI;
	vec2 head = uC + uRad * vec2(sin(span), -cos(span));
	float hd = length(px - head);
	col += green * (exp(-hd / 8.0) * 1.6 + exp(-hd / 60.0) * 0.14) * uGreenI * (1.0 - step(1.19, uGreen));

	// Exit: everything collapses to one horizontal green line.
	float lineD = abs(px.y - uC.y + uRad);
	col = mix(col, green * (exp(-lineD * lineD / 3.0) * 2.0 + exp(-lineD / 18.0) * 0.14) * smoothstep(540.0 * (1.0 - uLine * 0.0) + 40.0, 0.0, abs(px.x - 540.0)), uLine);

	col *= uExposure;
	outColor = vec4(finalize(col), 1.0);
}`;

export const S17Alcance: React.FC<SceneProps> = ({f}) => {
	const m = meta('S17');
	const pull = ramp(f, -14, 176, ease.camera);
	const rad = mix(5200, 1700, pull);
	const topY = mix(1360, 840, pull);
	const exitLine = ramp(f, 160, 194, ease.inOut);
	const uniforms = {
		uC: [540, topY + rad],
		uRad: rad,
		uGreen: ramp(f, 24, 150, ease.inOutSine),
		uGreenI: ramp(f, 20, 40),
		uLight: ramp(f, -14, 30, ease.inOutSine) * (1 - exitLine),
		uExposure: mix(9.0, 1.0, ramp(f, -14, 36, ease.outCubic)),
		uLine: exitLine,
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#050505', opacity: ramp(f, -14, -2)}}>
			<ShaderCanvas frag={FRAG} uniforms={uniforms} />
			<KineticText lines={m.lines} f={f} inAt={40} outAt={140} top={250} />
		</AbsoluteFill>
	);
};
