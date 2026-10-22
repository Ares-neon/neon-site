import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {ShaderCanvas} from '../components/ShaderCanvas';
import {KineticText} from '../components/KineticText';
import {GLSL_COMMON} from '../gl/common';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import type {SceneProps} from './types';

// Macro of a black, finely grained surface with the NEON symbol debossed into
// it. Geometry comes from the traced logo's signed distance field, so the
// mark is the official one. A raking light crosses the frame and finds the
// bevels.
const FRAG = `${GLSL_COMMON}
uniform sampler2D uSdf;
uniform vec3 uCam;      // camera position in plane units (x, y, distance)
uniform float uPitch;   // tilt of the camera relative to the plane
uniform float uYaw;
uniform float uLightA;  // azimuth of the raking light
uniform float uLightE;  // elevation
uniform float uLight;
uniform float uFocal;

const float SYM = 1.39;      // texture span in plane units (symbol height = 1.0)
const float DEPTH = 0.020;
const float BEVEL = 0.010;

float sdfAt(vec2 uv) {
	vec2 tc = uv / SYM + 0.5;
	if (tc.x < 0.0 || tc.y < 0.0 || tc.x > 1.0 || tc.y > 1.0) return 1.0;
	float r = texture(uSdf, vec2(tc.x, 1.0 - tc.y)).r;
	return (r - 0.5) * 48.0 / 1024.0 * SYM;   // plane units, negative inside
}
float heightAt(vec2 uv) {
	float d = sdfAt(uv);
	float engr = -DEPTH * clamp((BEVEL - d) / (2.0 * BEVEL), 0.0, 1.0);
	float grain = (fbm(uv * 90.0, 4) - 0.5) * 0.0016 + (vnoise(uv * 420.0) - 0.5) * 0.0005;
	float inside = clamp((BEVEL - d) / (2.0 * BEVEL), 0.0, 1.0);
	return engr + grain * (1.0 - 0.7 * inside);
}

void main() {
	vec2 px = pixelCoord();
	vec3 rd = normalize(vec3((px.x - 540.0) / uFocal, (px.y - 960.0) / uFocal, 1.0));
	float cp = cos(uPitch), sp = sin(uPitch);
	rd = vec3(rd.x, rd.y * cp - rd.z * sp, rd.y * sp + rd.z * cp);
	float cy = cos(uYaw), sy = sin(uYaw);
	rd = vec3(rd.x * cy + rd.z * sy, rd.y, -rd.x * sy + rd.z * cy);
	vec3 ro = vec3(uCam.x, uCam.y, -uCam.z);
	float t = -ro.z / rd.z;
	vec2 uv = (ro + rd * t).xy;

	float e = 0.0012;
	float h = heightAt(uv);
	float hx = heightAt(uv + vec2(e, 0.0));
	float hy = heightAt(uv + vec2(0.0, e));
	vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, -1.0));   // facing the camera (-z)
	vec3 L = normalize(vec3(cos(uLightA) * cos(uLightE), sin(uLightA) * cos(uLightE), -sin(uLightE)));
	vec3 V = normalize(-rd);
	float diff = max(dot(n, L), 0.0);
	vec3 H = normalize(L + V);
	float d = sdfAt(uv);
	float inside = clamp((BEVEL - d) / (2.0 * BEVEL), 0.0, 1.0);
	float rough = mix(22.0, 60.0, inside);
	float spec = pow(max(dot(n, H), 0.0), rough) * mix(0.10, 0.35, inside);
	float alb = 0.030 + 0.012 * fbm(uv * 30.0, 3);
	// Occlusion at the floor of the engraving.
	float ao = mix(1.0, 0.55, inside * (1.0 - clamp(-d / (BEVEL * 3.0), 0.0, 1.0)));
	// Falloff of the raking light across the plane.
	vec2 lp = vec2(cos(uLightA), sin(uLightA)) * -1.6;
	float fall = exp(-length(uv - lp * 0.0) * 0.35);
	vec3 col = vec3(alb * (0.05 + 1.6 * diff) * ao + spec) * fall * uLight;
	// Grazing sheen along the bevels.
	float bev = smoothstep(0.0, 1.0, inside) * (1.0 - inside) * 4.0;
	col += vec3(bev * diff * 0.06 * uLight);
	outColor = vec4(finalize(col * 1.3), 1.0);
}`;

export const S13Identidade: React.FC<SceneProps> = ({f}) => {
	const m = meta('S13');
	const cam = ramp(f, -12, 208, ease.inOutSine);
	// Aim the optical axis at a point that drifts across the symbol.
	const D = mix(2.55, 2.2, cam);
	const pitch = mix(-0.34, -0.26, cam);
	const yaw = mix(0.16, 0.06, cam);
	const tx = mix(-0.16, 0.06, cam);
	const ty = mix(0.10, -0.02, cam);
	const uniforms = {
		uCam: [tx - D * Math.tan(yaw), ty - D * Math.tan(-pitch), D],
		uPitch: pitch,
		uYaw: yaw,
		uLightA: mix(Math.PI * 0.94, Math.PI * 0.12, ramp(f, -12, 190, ease.inOutSine)),
		uLightE: mix(0.16, 0.28, ramp(f, -12, 190, ease.inOutSine)),
		uLight: ramp(f, -12, 24, ease.inOutSine) * (1 - 0.2 * ramp(f, 180, 208)),
		uFocal: 2100,
	};
	return (
		<AbsoluteFill style={{backgroundColor: '#050505', opacity: ramp(f, -12, 0)}}>
			<ShaderCanvas frag={FRAG} uniforms={uniforms} textures={{uSdf: staticFile('textures/neon-symbol-sdf.png')}} />
			<KineticText lines={m.lines} f={f} inAt={36} outAt={140} top={250} />
		</AbsoluteFill>
	);
};
