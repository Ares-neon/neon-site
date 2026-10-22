import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo, useRef} from 'react';
import * as THREE from 'three';
import type {Vec3} from './Silk';

const lineVert = `
varying vec2 vUv;
void main() {
	vUv = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const lineFrag = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uCore;   // core half-width as a fraction of the quad half-width
uniform float uFadeEnds;
varying vec2 vUv;
void main() {
	float x = abs(vUv.x - 0.5) * 2.0;           // 0 at the line, 1 at the quad edge
	float core = smoothstep(uCore * 1.6, uCore * 0.6, x);
	float glow = exp(-x / max(uCore * 3.0, 0.004)) * 0.55 + exp(-x * 4.0) * 0.18 + (1.0 - x) * 0.04;
	float ends = smoothstep(0.0, uFadeEnds, vUv.y) * smoothstep(1.0, 1.0 - uFadeEnds, vUv.y);
	vec3 c = uColor * (core * 1.0 + glow) * uIntensity * ends;
	c += vec3(1.0) * core * uIntensity * 0.35 * ends; // hot white core
	gl_FragColor = vec4(c, 1.0);
}`;

/**
 * A line of light between two points: a camera-facing quad with a hot core
 * and an exponential halo, blended additively. Cheap stand-in for bloom.
 */
export const GlowLine: React.FC<{
	from: Vec3;
	to: Vec3;
	/** Total width of the halo in world units. */
	width: number;
	/** Core width in world units. */
	core: number;
	color: string;
	intensity?: number;
	fadeEnds?: number;
	depthTest?: boolean;
}> = ({from, to, width, core, color, intensity = 1, fadeEnds = 0.02, depthTest = true}) => {
	const camera = useThree((s) => s.camera);
	const mesh = useRef<THREE.Mesh>(null);
	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: lineVert,
				fragmentShader: lineFrag,
				uniforms: {
					uColor: {value: new THREE.Color(color)},
					uIntensity: {value: intensity},
					uCore: {value: 0.05},
					uFadeEnds: {value: fadeEnds},
				},
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				depthTest,
				toneMapped: false,
				side: THREE.DoubleSide,
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);
	useLayoutEffect(() => () => material.dispose(), [material]);

	useLayoutEffect(() => {
		const m = mesh.current;
		if (!m) return;
		const a = new THREE.Vector3(...from);
		const b = new THREE.Vector3(...to);
		const axis = b.clone().sub(a);
		const len = Math.max(axis.length(), 1e-5);
		axis.normalize();
		const mid = a.clone().add(b).multiplyScalar(0.5);
		const view = camera.position.clone().sub(mid).normalize();
		const across = new THREE.Vector3().crossVectors(axis, view).normalize();
		const normal = new THREE.Vector3().crossVectors(across, axis).normalize();
		const basis = new THREE.Matrix4().makeBasis(across.multiplyScalar(width), axis.multiplyScalar(len), normal);
		basis.setPosition(mid);
		m.matrix.copy(basis);
		m.matrixWorldNeedsUpdate = true;
		material.uniforms.uColor.value.set(color);
		material.uniforms.uIntensity.value = intensity;
		material.uniforms.uCore.value = Math.min(1, core / width);
		material.uniforms.uFadeEnds.value = fadeEnds;
	});

	return (
		<mesh ref={mesh} matrixAutoUpdate={false} material={material} frustumCulled={false} renderOrder={10}>
			<planeGeometry args={[1, 1]} />
		</mesh>
	);
};

const pointFrag = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
	float r = length(vUv - 0.5) * 2.0;
	float g = exp(-r * 9.0) * 0.9 + exp(-r * 3.2) * 0.25 + max(1.0 - r, 0.0) * 0.03;
	gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
}`;

/** Round glow sprite (always faces the camera). */
export const GlowPoint: React.FC<{position: Vec3; size: number; color: string; intensity?: number; depthTest?: boolean}> = ({
	position,
	size,
	color,
	intensity = 1,
	depthTest = true,
}) => {
	const camera = useThree((s) => s.camera);
	const mesh = useRef<THREE.Mesh>(null);
	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: lineVert,
				fragmentShader: pointFrag,
				uniforms: {uColor: {value: new THREE.Color(color)}, uIntensity: {value: intensity}},
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				depthTest,
				toneMapped: false,
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);
	useLayoutEffect(() => () => material.dispose(), [material]);
	useLayoutEffect(() => {
		const m = mesh.current;
		if (!m) return;
		m.position.set(...position);
		m.quaternion.copy(camera.quaternion);
		m.scale.setScalar(size);
		material.uniforms.uColor.value.set(color);
		material.uniforms.uIntensity.value = intensity;
	});
	return (
		<mesh ref={mesh} material={material} frustumCulled={false} renderOrder={11}>
			<planeGeometry args={[1, 1]} />
		</mesh>
	);
};
