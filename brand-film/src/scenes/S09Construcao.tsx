import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {KineticText} from '../components/KineticText';
import {CameraRig, Exposure, StudioEnv} from '../three/StudioEnv';
import {GlowLine} from '../three/Glow';
import {noiseTexture} from '../three/textures';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

RectAreaLightUniformsLib.init();

const W = 2.6;
const D = 1.75;
const T = 0.05;
const GAP = 0.25;

type PlateDef = {
	from: [number, number, number];
	fromRot: [number, number, number];
	at: number; // frame the plate starts moving
	mat: 'black' | 'frost' | 'green' | 'white';
};

// Base plate (with the green edge) is in place from the start: seen edge-on,
// it continues the floor line of scene 08. The others arrive on the beat.
const PLATES: PlateDef[] = [
	{from: [0, 0, 0], fromRot: [0, 0, 0], at: -100, mat: 'black'},
	// Each plate seats ~16 frames after it starts: on beat 2, its "and", beat 3, its "and".
	{from: [-7, 0.6, 1.2], fromRot: [0, 0.5, 0], at: 29, mat: 'white'},
	{from: [7, 1.2, -0.8], fromRot: [0, -0.45, 0], at: 51.5, mat: 'green'},
	{from: [-1.5, 6.5, 0.6], fromRot: [0.18, 0.3, -0.1], at: 74, mat: 'frost'},
	{from: [1.2, 8.0, -0.4], fromRot: [-0.15, -0.25, 0.12], at: 96.5, mat: 'black'},
];

export const S09Construcao: React.FC<SceneProps> = ({f}) => {
	const m = meta('S09');
	const mats = useMemo(() => {
		const n = noiseTexture(256, 6, 4, 2.2, 0.8);
		return {
			black: new THREE.MeshStandardMaterial({color: '#0e0e0e', roughness: 0.42, roughnessMap: n}),
			white: new THREE.MeshStandardMaterial({color: '#a9a9a9', roughness: 0.75, roughnessMap: n}),
			frost: new THREE.MeshPhysicalMaterial({
				color: '#cfd6d2',
				roughness: 0.32,
				transparent: true,
				opacity: 0.32,
				clearcoat: 0.6,
				clearcoatRoughness: 0.25,
				depthWrite: false,
			}),
			green: new THREE.MeshPhysicalMaterial({
				color: '#062a12',
				emissive: new THREE.Color(COLORS.green),
				emissiveIntensity: 0.13,
				roughness: 0.35,
				transparent: true,
				opacity: 0.9,
				clearcoat: 0.8,
			}),
			edge: new THREE.MeshBasicMaterial({color: COLORS.green, toneMapped: false}),
		};
	}, []);

	const cam = ramp(f, -10, 150, ease.inOut);
	const orbit = ramp(f, -10, 188, ease.inOutSine);
	const camPos: [number, number, number] = [
		Math.sin(mix(0, 0.5, orbit)) * mix(9, 9.8, cam),
		mix(0, 4.6, cam),
		Math.cos(mix(0, 0.5, orbit)) * mix(9, 9.8, cam),
	];
	const target: [number, number, number] = [0, mix(1.29, 0.45, cam), 0];
	const beam = ramp(f, 150, 180, ease.inCubic);
	const exitDim = ramp(f, 166, 188, ease.inOutSine);
	const fadeIn = ramp(f, -10, 0);

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: fadeIn}}>
			<ThreeCanvas width={1080} height={1920} shadows gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={['#000000']} />
				<CameraRig position={camPos} target={target} fov={32} />
				<Exposure value={1.25 * (1 - 0.85 * exitDim)} />
				<StudioEnv
					intensity={0.8}
					panels={[
						{position: [0, 10, 2], size: [10, 6], intensity: 1.6},
						{position: [-9, 3, -4], size: [3, 8], intensity: 0.8},
						{position: [8, 2, 6], size: [2, 6], intensity: 0.6},
					]}
				/>
				<rectAreaLight position={[-1.5, 6, 2.5]} rotation={[-Math.PI / 2.4, -0.25, 0]} width={5} height={2.5} intensity={1.3} />
				<directionalLight
					position={[-3, 9, 4]}
					intensity={1.6}
					castShadow
					shadow-mapSize-width={2048}
					shadow-mapSize-height={2048}
					shadow-bias={-0.0003}
					shadow-camera-left={-4}
					shadow-camera-right={4}
					shadow-camera-top={4}
					shadow-camera-bottom={-4}
				/>
				<directionalLight position={[4, 2, -6]} intensity={1.4} />
				{/* green light spilling from the green layer onto its neighbours */}
				<rectAreaLight position={[0, 2 * GAP + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]} width={W * 0.9} height={D * 0.9} intensity={0.45 * ramp(f, 66, 96)} color={COLORS.green} />
				<rectAreaLight position={[0, 2 * GAP - 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} width={W * 0.9} height={D * 0.9} intensity={0.45 * ramp(f, 66, 96)} color={COLORS.green} />
				{PLATES.map((p, i) => {
					const k = ramp(f, p.at, p.at + 44, ease.outExpo);
					const settle = ramp(f, p.at + 20, p.at + 60, ease.outCubic);
					const pos: [number, number, number] = [mix(p.from[0], 0, k), mix(p.from[1] + i * GAP, i * GAP, k), mix(p.from[2], 0, k)];
					const rot: [number, number, number] = [
						p.fromRot[0] * (1 - settle),
						p.fromRot[1] * (1 - settle),
						p.fromRot[2] * (1 - settle),
					];
					return (
						<group key={i} position={pos} rotation={rot}>
							<mesh castShadow receiveShadow material={mats[p.mat]} renderOrder={p.mat === 'frost' ? 2 : 0}>
								<boxGeometry args={[W, T, D]} />
							</mesh>
							{i === 0 ? (
								<>
									<mesh position={[0, 0, D / 2 + 0.004]} material={mats.edge}>
										<boxGeometry args={[W, T * 0.5, 0.008]} />
									</mesh>
									<mesh position={[0, 0, -D / 2 - 0.004]} material={mats.edge}>
										<boxGeometry args={[W, T * 0.5, 0.008]} />
									</mesh>
									<mesh position={[W / 2 + 0.004, 0, 0]} material={mats.edge}>
										<boxGeometry args={[0.008, T * 0.5, D]} />
									</mesh>
									<mesh position={[-W / 2 - 0.004, 0, 0]} material={mats.edge}>
										<boxGeometry args={[0.008, T * 0.5, D]} />
									</mesh>
									<GlowLine from={[-W / 2, 0, D / 2 + 0.01]} to={[W / 2, 0, D / 2 + 0.01]} width={0.22} core={0.012} color={COLORS.green} intensity={0.6} fadeEnds={0.02} />
								</>
							) : null}
						</group>
					);
				})}
				{beam > 0.001 ? (
					<GlowLine from={[0, 4 * GAP + 0.03, 0]} to={[0, 4 * GAP + 0.03 + 14 * beam, 0]} width={0.5} core={0.02} color={COLORS.green} intensity={1.2} fadeEnds={0.01} depthTest={false} />
				) : null}
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={30} outAt={136} top={250} />
		</AbsoluteFill>
	);
};
