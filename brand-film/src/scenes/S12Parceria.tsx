import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {KineticText} from '../components/KineticText';
import {GLSL_COMMON} from '../gl/common';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import type {SceneProps} from './types';

// Two large curved surfaces, matte white (below) and gloss black (above),
// slide towards each other and close along an S-curve. Each has a rounded
// edge (bevel) lit from the upper left, so the meeting reads in volume.
const FRAG = `${GLSL_COMMON}
uniform float uGap;
uniform float uShift;
uniform float uRoll;
uniform float uZoom;
uniform float uSeam;
uniform float uPhase;
uniform float uLight;

float curve(float x) {
	float u = x / 1080.0 - 0.5;
	return 990.0 + uShift + 300.0 * sin(u * 3.3 + uPhase) - 120.0 * u;
}
// Signed vertical distance to a curve, corrected by the slope (approx. normal distance).
float distTo(vec2 p, float off) {
	float c = curve(p.x) + off;
	float dc = (curve(p.x + 1.0) - curve(p.x - 1.0)) * 0.5;
	return (p.y - c) / sqrt(1.0 + dc * dc);
}
vec2 gradOf(vec2 p, float off) {
	float dc = (curve(p.x + 1.0) - curve(p.x - 1.0)) * 0.5;
	return normalize(vec2(-dc, 1.0));
}

void main() {
	vec2 px = pixelCoord();
	vec2 c0 = vec2(540.0, 960.0);
	vec2 q = px - c0;
	float cr = cos(uRoll), sr = sin(uRoll);
	px = mat2(cr, -sr, sr, cr) * q / uZoom + c0;

	vec3 L = normalize(vec3(-0.45, -0.7, 0.55));   // y down: light from the upper left
	vec3 col = vec3(0.0);
	float R = 70.0;                                  // bevel radius (px)

	// White surface: below the curve (+gap/2).
	float dw = distTo(px, uGap * 0.5);               // > 0 inside the white surface
	vec2 gw = gradOf(px, uGap * 0.5);
	// Black surface: above the curve (-gap/2).
	float db = -distTo(px, -uGap * 0.5);             // > 0 inside the black surface
	vec2 gb = -gradOf(px, -uGap * 0.5);

	float tex = fbm(px / 9.0, 3);
	if (dw > 0.0) {
		float t = clamp(dw / R, 0.0, 1.0);
		float slope = (1.0 - t) / max(sqrt(1.0 - (1.0 - t) * (1.0 - t)), 0.05);
		vec3 n = normalize(vec3(-gw * slope, 1.0));
		float diff = max(dot(n, L), 0.0);
		float alb = 0.62 + 0.04 * tex;
		float ao = mix(0.55, 1.0, smoothstep(0.0, 160.0, db < 0.0 ? -db : 0.0) + 0.0) ;
		float spec = pow(max(dot(n, normalize(L + vec3(0, 0, 1))), 0.0), 18.0) * 0.12;
		vec3 w = vec3(alb * (0.10 + 0.9 * diff) + spec);
		// Soft occlusion where the two surfaces nearly touch.
		float gap = max(dw + max(db, -db) * 0.0, 0.0);
		w *= mix(1.0, 0.45, exp(-(uGap + dw) / 90.0));
		col = w * smoothstep(0.0, 1.5, dw);
	}
	if (db > 0.0) {
		float t = clamp(db / R, 0.0, 1.0);
		float slope = (1.0 - t) / max(sqrt(1.0 - (1.0 - t) * (1.0 - t)), 0.05);
		vec3 n = normalize(vec3(-gb * slope, 1.0));
		float diff = max(dot(n, L), 0.0);
		vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
		float spec = pow(max(dot(n, H), 0.0), 90.0) * 1.4 + pow(max(dot(n, H), 0.0), 12.0) * 0.05;
		float alb = 0.012 + 0.006 * tex;
		vec3 b = vec3(alb * diff + spec);
		// Broad reflection of a softbox on the gloss surface.
		b += vec3(0.02 * smoothstep(400.0, 0.0, abs(px.x - 300.0 - db * 0.4)) * smoothstep(600.0, 80.0, db));
		col = mix(col, b, smoothstep(0.0, 1.5, db));
	}
	// The seam of light where they meet.
	float seamD = abs(distTo(px, 0.0));
	col += vec3(uSeam * (exp(-seamD * seamD / 3.0) * 1.4 + exp(-seamD / 24.0) * 0.12)) * (1.0 - smoothstep(0.0, 30.0, uGap));
	col *= uLight;
	outColor = vec4(finalize(col), 1.0);
}`;

export const S12Parceria: React.FC<SceneProps> = ({f}) => {
	const m = meta('S12');
	// The surfaces touch on beat 3 of the bar (frame 90).
	const close = ramp(f, -26, 90, ease.inOut);
	const meet = ramp(f, 84, 96);
	const fill = ramp(f, 150, 190, ease.inCubic);
	const uniforms = {
		uGap: mix(520, 0, close),
		uShift: mix(0, 1400, fill),
		uRoll: mix(-0.06, 0.03, ramp(f, -26, 192, ease.inOutSine)),
		uZoom: mix(1.0, 1.06, ramp(f, -26, 192, ease.camera)),
		uSeam: meet * (1 - ramp(f, 108, 160, ease.inOutSine)),
		uPhase: mix(0.2, -0.25, ramp(f, -26, 192, ease.inOutSine)),
		uLight: 1,
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#050505'}}>
			<ShaderCanvas frag={FRAG} uniforms={uniforms} />
			<KineticText lines={m.lines} f={f} inAt={34} outAt={140} top={250} />
		</AbsoluteFill>
	);
};
