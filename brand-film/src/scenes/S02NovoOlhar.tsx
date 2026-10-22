import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {KineticText} from '../components/KineticText';
import {GLSL_COMMON} from '../gl/common';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import type {SceneProps} from './types';

// Macro of a human iris in black and white. The iris is a relief (fibres,
// collarette, crypts, furrows) lit from the upper right; the corneal
// catchlight is the doorway of scene 01. At the end everything but the
// limbus falls away and the eye becomes a single clean ring.
const FRAG = `${GLSL_COMMON}
uniform vec2 uCenter;
uniform float uR;
uniform float uZoom;
uniform float uPupil;
uniform float uDetail;
uniform float uLids;
uniform float uRing;
uniform float uGreen;
uniform float uExposure;
uniform float uCatch;

// Relief of the iris stroma, in (angle, normalised radius).
float stroma(vec2 cs, float s) {
	float w = fbm3(vec3(cs * 4.0, s * 1.3 + 11.0), 3);
	float fib = fbm3(vec3(cs * 17.0 + (w - 0.5) * 2.6, s * 2.3), 4);
	float colR = 0.31 + 0.07 * (fbm3(vec3(cs * 6.0, 4.0), 2) - 0.5) * 2.0;
	float collarette = exp(-pow((s - colR) / 0.05, 2.0));
	float cryptN = fbm3(vec3(cs * 15.0, s * 1.8 + 5.0), 3);
	float crypts = smoothstep(0.60, 0.70, cryptN) * smoothstep(0.34, 0.46, s) * (1.0 - smoothstep(0.76, 0.9, s));
	return fib * 0.9 + collarette * 0.55 - crypts * 0.55;
}

void main() {
	vec2 px = pixelCoord();
	vec2 p = (px - uCenter) / uZoom;
	float R = uR;
	float r = length(p) / R;
	float th = atan(p.y, p.x);
	vec2 cs = vec2(cos(th), sin(th));
	float rp = uPupil * (1.0 + 0.02 * (fbm3(vec3(cs * 9.0, 2.0), 2) - 0.5));
	float s = clamp((r - rp) / (1.0 - rp), 0.0, 1.0);
	vec3 col = vec3(0.0);

	// ---------------- iris -------------------------------------------------
	float iris = 0.0;
	if (r < 1.12) {
		float e = 0.004;
		float h0 = stroma(cs, s);
		float hs = stroma(cs, s + e);
		float ca = cos(e), sa = sin(e);
		float ht = stroma(vec2(cs.x * ca - cs.y * sa, cs.x * sa + cs.y * ca), s);
		vec2 tang = vec2(-cs.y, cs.x);
		vec2 grad = cs * (hs - h0) / (e * (1.0 - rp) * R) + tang * (ht - h0) / (e * max(r, 0.05) * R);
		vec3 n = normalize(vec3(-grad * 26.0, 1.0));
		vec3 L = normalize(vec3(0.55, -0.62, 0.56));
		float diff = max(dot(n, L), 0.0);
		float albedo = 0.16 + 0.30 * smoothstep(0.2, 0.9, h0) + 0.05 * fbm3(vec3(cs * 40.0, s * 3.0), 2);
		float furrows = smoothstep(0.86, 1.0, 0.5 + 0.5 * sin(s * 52.0 + (fbm3(vec3(cs * 3.0, 1.0), 2) - 0.5) * 9.0)) * smoothstep(0.64, 0.76, s);
		albedo *= 1.0 - 0.18 * furrows;
		float ruff = exp(-pow(s / 0.05, 2.0));
		albedo *= 1.0 - 0.7 * ruff;
		albedo *= mix(1.0, 0.07, smoothstep(0.72, 1.0, s));
		albedo *= mix(0.6, 1.0, smoothstep(0.0, 0.2, s));
		iris = albedo * (0.18 + 0.95 * diff);
	}

	// ---------------- sclera, pupil, lids ---------------------------------
	float limbus = smoothstep(0.985, 1.025, r);
	float scl = 0.085 * (1.0 - smoothstep(1.0, 2.3, r)) * (0.85 + 0.15 * fbm(p / R * 3.0, 3));
	scl *= 0.7 + 0.45 * smoothstep(-1.4, 1.4, p.x / R);
	float eye = mix(iris, scl, limbus);
	float pupilMask = smoothstep(rp + 0.005, rp - 0.005, r);
	eye = mix(eye, 0.0015, pupilMask);

	float xn = p.x / (1.65 * R);
	float upper = -0.80 * R + 0.42 * R * xn * xn;
	float lower = 0.98 * R - 0.36 * R * xn * xn;
	float opening = smoothstep(upper - 2.5, upper + 2.5, p.y) * smoothstep(lower + 2.5, lower - 2.5, p.y);
	eye *= mix(0.12, 1.0, smoothstep(upper, upper + 0.42 * R, p.y));
	eye *= mix(0.55, 1.0, smoothstep(lower, lower - 0.16 * R, p.y));
	float skinN = fbm(p / R * 2.2, 4);
	float skin = 0.0035 + 0.003 * skinN;
	skin += 0.022 * exp(-pow((p.y - upper + 9.0) / 6.0, 2.0)) * (0.6 + 0.4 * skinN);
	skin += 0.014 * exp(-pow((p.y - lower - 8.0) / 8.0, 2.0)) * (0.6 + 0.4 * skinN);
	col = vec3(mix(skin, eye, opening));

	// Everything but the ring falls to black: surroundings first, iris after.
	col *= mix(uLids, uDetail, (1.0 - limbus) * opening);

	// ---------------- cornea reflections ----------------------------------
	float onCornea = smoothstep(1.05, 1.0, r) * opening;
	vec2 pc = p / R - vec2(0.31, -0.37);
	pc *= 1.0 + 1.2 * dot(pc, pc);
	float dCat = sdBox(pc, vec2(0.026, 0.074)) - 0.010;
	float cat = smoothstep(0.010, -0.010, dCat) * mix(1.0, 0.75, smoothstep(-0.08, 0.08, pc.y));
	col += vec3(onCornea * uCatch * (3.6 * cat + 0.30 * exp(-max(dCat, 0.0) / 0.012) + 0.05 * exp(-max(dCat, 0.0) / 0.06)));
	float soft = exp(-pow(length((p / R - vec2(-0.42, -0.48)) * vec2(1.0, 1.5)) / 0.30, 2.0));
	col += vec3(onCornea * uCatch * 0.012 * soft);

	// A small green glint: a reflected light strip, lower left.
	vec3 green = srgb2lin(vec3(0.0, 230.0, 59.0) / 255.0);
	vec2 pg = p / R - vec2(-0.44, 0.27);
	pg *= 1.0 + 1.2 * dot(pg, pg);
	pg.x += 0.35 * pg.y * pg.y;
	float gLen = 0.07 * uGreen;
	float dG = sdBox(pg - vec2(0.0, 0.07 - gLen), vec2(0.0035, gLen)) - 0.003;
	float taper = 1.0 - smoothstep(0.2, 1.0, abs(pg.y - 0.07 + gLen) / max(gLen, 1e-3));
	float glint = smoothstep(0.005, -0.005, dG) * 2.0 * (0.35 + 0.65 * taper) + exp(-max(dG, 0.0) / 0.014) * 0.25 + exp(-max(dG, 0.0) / 0.08) * 0.025;
	col += green * glint * onCornea * uGreen * uDetail;
	col += green * 0.010 * exp(-length(pg) / 0.22) * (1.0 - limbus) * (1.0 - pupilMask) * uGreen * uDetail * opening;

	// ---------------- the ring --------------------------------------------
	float ringD = abs(r - 1.0) * R * uZoom;
	col += vec3(uRing * (exp(-ringD * ringD / 2.0) * 2.4 + exp(-ringD / 16.0) * 0.12));

	col *= uExposure;
	outColor = vec4(finalize(col), 1.0);
}`;

export const S02NovoOlhar: React.FC<SceneProps> = ({f}) => {
	const m = meta('S02');
	const push = ramp(f, 150, 178, ease.inCubic);
	const uniforms = {
		uCenter: [mix(548, 532, ramp(f, -14, 180, ease.inOutSine)), mix(902, 884, ramp(f, -14, 180, ease.inOutSine))],
		uR: 470,
		uZoom: mix(1.0, 1.17, ramp(f, -14, 150, ease.camera)) * (1 + 5.0 * push),
		uPupil: mix(0.37, 0.30, ramp(f, -6, 110, ease.inOutSine)),
		uDetail: 1 - ramp(f, 130, 156, ease.inOut),
		uLids: 1 - ramp(f, 124, 148, ease.inOut),
		uRing: ramp(f, 134, 156, ease.inOut) * (1 - ramp(f, 172, 180)),
		uGreen: ramp(f, 40, 96, ease.inOut),
		uExposure: mix(14.0, 1.0, ramp(f, -14, 30, ease.outCubic)),
		uCatch: 1 - ramp(f, 124, 146),
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#050505', opacity: ramp(f, -14, -4)}}>
			<ShaderCanvas frag={FRAG} uniforms={uniforms} />
			<KineticText lines={m.lines} f={f} inAt={30} outAt={122} bottom={1660} />
		</AbsoluteFill>
	);
};
