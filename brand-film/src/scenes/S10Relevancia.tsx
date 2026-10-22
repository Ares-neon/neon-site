import React, {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {KineticText} from '../components/KineticText';
import {CameraRig, Exposure} from '../three/StudioEnv';
import {GlowLine, GlowPoint} from '../three/Glow';
import {fbm3, simplex3} from '../lib/noise';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

const SIZE = 90;
const SEG = 420;
export const PEAK_H = 11.2;

// Single dominant peak with ridged flanks, eroded detail and snow on the
// gentler high slopes. Built once per mount; deterministic.
const RIDGES = [0.35, 2.05, 3.6, 5.1];
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const height = (x: number, z: number) => {
	const r = Math.hypot(x, z);
	const ang = Math.atan2(z, x);
	const u = Math.max(0, 1 - r / 20);
	// Pyramidal summit: faces between four main ridges.
	let ridge = 0;
	for (const a of RIDGES) {
		const wob = 0.18 * simplex3(r * 0.12, a, 1.7);
		ridge = Math.max(ridge, Math.exp(-Math.pow(angDiff(ang, a + wob) / 0.32, 2)));
	}
	const peak = PEAK_H * Math.pow(u, 1.55) * (0.84 + 0.22 * ridge);
	// Couloirs running down the faces.
	const gully = Math.pow(1 - Math.abs(simplex3(Math.cos(ang) * 2.6, Math.sin(ang) * 2.6, r * 0.11)), 4) * 1.1 * Math.min(1, peak / 4);
	// Rock detail: ridged fbm, kept low so the big forms read first.
	let rf = 0;
	let a = 0.5;
	let fx = x * 0.16;
	let fz = z * 0.16;
	for (let o = 0; o < 5; o++) {
		rf += a * (1 - Math.abs(simplex3(fx, fz, o * 7.1)));
		fx *= 2.1;
		fz *= 2.1;
		a *= 0.48;
	}
	const detail = (rf - 0.55) * 1.1 * (0.35 + 0.65 * Math.min(1, peak / 6));
	const range = 4.6 * Math.max(0, fbm3(x * 0.045 + 3, z * 0.045 - 2, 0.5, 4)) * Math.min(1, Math.max(0, (r - 15) / 12));
	return peak - gully + detail + range;
};

const Terrain: React.FC = () => {
	const geometry = useMemo(() => {
		const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
		g.rotateX(-Math.PI / 2);
		const pos = g.getAttribute('position') as THREE.BufferAttribute;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const z = pos.getZ(i);
			pos.setY(i, height(x, z));
		}
		g.computeVertexNormals();
		const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
		const colors = new Float32Array(pos.count * 3);
		for (let i = 0; i < pos.count; i++) {
			const y = pos.getY(i);
			const ny = nrm.getY(i);
			const x = pos.getX(i);
			const z = pos.getZ(i);
			const rock = 0.07 + 0.06 * (0.5 + 0.5 * simplex3(x * 0.7, z * 0.7, 2.3));
			const snowLine = 4.6 + 1.0 * simplex3(x * 0.25, z * 0.25, 9.1);
			const snow = Math.min(1, Math.max(0, (ny - 0.5) / 0.2)) * Math.min(1, Math.max(0, (y - snowLine) / 1.8));
			const c = rock + (0.78 - rock) * snow;
			colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = c;
		}
		g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		return g;
	}, []);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	const material = useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95, metalness: 0}), []);
	return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
};

const Atmosphere: React.FC<{density: number}> = ({density}) => {
	const scene = useThree((s) => s.scene);
	useLayoutEffect(() => {
		scene.fog = new THREE.FogExp2('#0d0d0d', density);
		return () => {
			scene.fog = null;
		};
	}, [scene, density]);
	return null;
};

const skyFrag = `
varying vec2 vUv;
void main() {
	float h = vUv.y;
	float c = mix(0.055, 0.0, smoothstep(0.38, 0.85, h));
	gl_FragColor = vec4(vec3(c), 1.0);
}`;
const skyVert = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const S10Relevancia: React.FC<SceneProps> = ({f}) => {
	const m = meta('S10');
	const pull = ramp(f, -8, 194, ease.camera);
	const dist = mix(15, 44, pull);
	const camY = mix(PEAK_H - 2.0, PEAK_H + 1.5, pull);
	const az = mix(0.18, 0.05, pull);
	const camPos: [number, number, number] = [Math.sin(az) * dist, camY, Math.cos(az) * dist];
	const target: [number, number, number] = [0, mix(PEAK_H + 1.6, PEAK_H - 1.8, pull), 0];
	const collapse = ramp(f, 150, 192, ease.inOut);
	const beamTop = PEAK_H + mix(60, 0.4, collapse);
	const sky = useMemo(() => new THREE.ShaderMaterial({vertexShader: skyVert, fragmentShader: skyFrag, depthWrite: false, fog: false}), []);
	const fadeIn = ramp(f, -8, 0);
	const light = 1 - ramp(f, 160, 194, ease.inOutSine);

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: fadeIn}}>
			<ThreeCanvas width={1080} height={1920} shadows gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={['#000000']} />
				<CameraRig position={camPos} target={target} fov={38} far={600} />
				<Exposure value={1.35 * (0.15 + 0.85 * light)} />
				<Atmosphere density={0.022} />
				<mesh position={[0, 30, -160]} material={sky}>
					<planeGeometry args={[600, 200]} />
				</mesh>
				<Terrain />
				<hemisphereLight args={['#9a9a9a', '#000000', 0.12]} />
				<directionalLight
					position={[30, 22, -18]}
					intensity={4.2}
					castShadow
					shadow-mapSize-width={2048}
					shadow-mapSize-height={2048}
					shadow-bias={-0.0006}
					shadow-normalBias={0.04}
					shadow-camera-left={-30}
					shadow-camera-right={30}
					shadow-camera-top={30}
					shadow-camera-bottom={-30}
					shadow-camera-far={120}
				/>
				<directionalLight position={[-20, 8, 25]} intensity={0.25} />
				<GlowLine from={[0, PEAK_H + 0.15, 0]} to={[0, beamTop, 0]} width={mix(1.0, 1.6, pull)} core={mix(0.03, 0.06, pull)} color={COLORS.green} intensity={1.15} fadeEnds={0.004} />
				<GlowPoint position={[0, PEAK_H + 0.25, 0]} size={mix(2.2, 3.6, pull) * (1 + 1.5 * collapse)} color={COLORS.green} intensity={0.55 + 0.9 * collapse} />
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={30} outAt={140} bottom={1660} />
		</AbsoluteFill>
	);
};
