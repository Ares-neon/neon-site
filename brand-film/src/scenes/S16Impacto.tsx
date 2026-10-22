import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {KineticText} from '../components/KineticText';
import {CameraRig, Exposure} from '../three/StudioEnv';
import {ReflectiveFloor} from '../three/ReflectiveFloor';
import {noiseTexture} from '../three/textures';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

const ARCH_W = 3.2;
const ARCH_H = 6.4; // springing line + radius
const WALL_Z = -12;

const shaftVert = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const shaftFrag = `
uniform float uI;
varying vec2 vUv;
void main() {
	float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
	float a = pow(max(across, 0.0), 1.6) * smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
	gl_FragColor = vec4(vec3(a * uI), 1.0);
}`;

// A monumental black wall with an arched opening; white light pours through
// and lies on a polished floor. The camera advances into the light.
export const S16Impacto: React.FC<SceneProps> = ({f}) => {
	const m = meta('S16');
	const geo = useMemo(() => {
		const s = new THREE.Shape();
		s.moveTo(-40, 0);
		s.lineTo(40, 0);
		s.lineTo(40, 40);
		s.lineTo(-40, 40);
		s.lineTo(-40, 0);
		const hole = new THREE.Path();
		const r = ARCH_W / 2;
		const spring = ARCH_H - r;
		hole.moveTo(-r, 0);
		hole.lineTo(r, 0);
		hole.lineTo(r, spring);
		hole.absarc(0, spring, r, 0, Math.PI, false);
		hole.lineTo(-r, 0);
		s.holes.push(hole);
		const g = new THREE.ExtrudeGeometry(s, {depth: 1.6, bevelEnabled: false, curveSegments: 96});
		g.translate(0, 0, -0.8);
		return g;
	}, []);
	const mats = useMemo(() => {
		const n = noiseTexture(256, 4, 5, 9.2, 1.1);
		n.repeat.set(10, 10);
		return {
			wall: new THREE.MeshStandardMaterial({color: '#101010', roughness: 0.7, roughnessMap: n, bumpMap: n, bumpScale: 0.5}),
			light: new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: false}),
			shaft: new THREE.ShaderMaterial({
				vertexShader: shaftVert,
				fragmentShader: shaftFrag,
				uniforms: {uI: {value: 0.2}},
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide,
			}),
		};
	}, []);

	const push = ramp(f, -2, 194, ease.inQuad);
	const camZ = mix(9, WALL_Z + 0.4, push);
	const camY = mix(1.3, 2.4, push);
	const glow = ramp(f, 0, 30, ease.outCubic);
	const whiteout = ramp(f, 166, 194, ease.inCubic);
	mats.shaft.uniforms.uI.value = 0.13 * glow;

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black}}>
			<ThreeCanvas width={1080} height={1920} gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={['#000000']} />
				<CameraRig position={[mix(0.5, 0.0, push), camY, camZ]} target={[0, mix(4.6, 3.2, push), WALL_Z - 10]} fov={46} />
				<Exposure value={1.2 * (1 + 6 * whiteout)} />
				<ReflectiveFloor color="#0a0a0a" roughness={0.28} reflectivity={0.85} blur={0.006} />
				<mesh geometry={geo} position={[0, 0, WALL_Z]} material={mats.wall} />
				{/* The light beyond the opening. */}
				<mesh position={[0, 6, WALL_Z - 6]} material={mats.light}>
					<planeGeometry args={[30, 16]} />
				</mesh>
				{/* Light falling out of the arch onto the floor, and haze in the beam. */}
				<rectAreaLight position={[0, ARCH_H / 2, WALL_Z + 0.85]} rotation={[0, Math.PI, 0]} width={ARCH_W} height={ARCH_H} intensity={14 * glow} />
				<mesh position={[0, 0.01, WALL_Z + 6]} rotation={[-Math.PI / 2, 0, 0]} material={mats.shaft}>
					<planeGeometry args={[ARCH_W * 1.6, 12]} />
				</mesh>
				<mesh position={[0, ARCH_H / 2, WALL_Z + 3]} rotation={[0, 0, 0]} material={mats.shaft}>
					<planeGeometry args={[ARCH_W * 1.25, ARCH_H * 1.1]} />
				</mesh>
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={28} outAt={136} top={250} />
			<AbsoluteFill style={{backgroundColor: COLORS.white, opacity: whiteout * 0.9}} />
		</AbsoluteFill>
	);
};
