import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {KineticText} from '../components/KineticText';
import {Silk, type SilkMotion} from '../three/Silk';
import {CameraRig, Exposure, StudioEnv} from '../three/StudioEnv';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

const PI = Math.PI;

// Two-sided cloth: black satin face, white back. It drifts down a diagonal in
// slow motion and turns over on itself, so the folds alternate black/white.
const makeCloth = (sweep: number): SilkMotion => ({
	path: (s, t) => [
		s * 6.0 + 0.35 * Math.sin(2.1 * PI * s + 0.22 * t) - sweep * (6.5 + 3.0 * s),
		-s * 7.8 + 0.55 * Math.sin(1.5 * PI * s - 0.27 * t + 1.0) - 0.12 * t + sweep * 1.2,
		0.9 * Math.sin(2.3 * PI * s + 0.31 * t + 0.4) - 0.6 + sweep * 6.0 * (0.6 - s),
	],
	twist: (s, t) => 1.1 + 1.9 * Math.sin(1.4 * PI * s - 0.33 * t + 0.6) + 0.7 * Math.sin(3.1 * PI * s + 0.21 * t),
	width: (s) => 2.05 * (1 - 0.15 * Math.cos(2 * PI * s)),
	cup: (s, t) => 0.8 * Math.sin(2.6 * PI * s - 0.4 * t + 0.3) + 0.35 * Math.sin(7.0 * PI * s + 0.5 * t + 1.1),
	flutter: {amp: 0.09, freq: 4.2, speed: 0.22, seed: 1.3},
});

// Narrow green band crossing the composition the other way, behind.
const makeBand = (sweep: number): SilkMotion => ({
	path: (s, t) => [
		-s * 7.5 + 0.25 * Math.sin(1.8 * PI * s + 0.3 * t) + sweep * 7.0,
		-s * 4.2 + 0.4 * Math.sin(1.3 * PI * s - 0.35 * t + 2.0) + 0.3 + sweep * 2.0,
		-1.6 + 0.5 * Math.sin(2.0 * PI * s + 0.4 * t),
	],
	twist: (s, t) => 0.4 + 1.2 * Math.sin(1.7 * PI * s - 0.45 * t + 1.7),
	width: () => 0.42,
	cup: (s, t) => 0.4 * Math.sin(2.0 * PI * s + 0.3 * t),
	flutter: {amp: 0.02, freq: 3.5, speed: 0.3, seed: 4.1},
});

export const S03Ideias: React.FC<SceneProps> = ({f}) => {
	const m = meta('S03');
	const t = 2.0 + f / 60;
	const light = ramp(f, 0, 30, ease.outCubic);
	// Exit: the cloth is pulled across the lens and the black falls away,
	// uncovering the architecture of scene 04 that is already running below.
	const sweep = ramp(f, 148, 208, ease.inCubic);
	const bg = 1 - ramp(f, 166, 196, ease.inOutSine);
	const cloth = makeCloth(sweep);
	const band = makeBand(sweep);

	const mats = useMemo(
		() => ({
			face: new THREE.MeshPhysicalMaterial({
				color: '#121212',
				roughness: 0.27,
				sheen: 1.0,
				sheenColor: new THREE.Color('#a8a8a8'),
				sheenRoughness: 0.3,
				specularIntensity: 1.0,
				side: THREE.FrontSide,
			}),
			back: new THREE.MeshPhysicalMaterial({
				color: '#e6e6e6',
				roughness: 0.4,
				sheen: 0.5,
				sheenColor: new THREE.Color('#ffffff'),
				sheenRoughness: 0.4,
				side: THREE.BackSide,
			}),
			green: new THREE.MeshPhysicalMaterial({
				color: COLORS.green,
				roughness: 0.36,
				sheen: 0.8,
				sheenColor: new THREE.Color('#8dffa8'),
				sheenRoughness: 0.3,
				emissive: new THREE.Color(COLORS.green),
				emissiveIntensity: 0.06,
				side: THREE.DoubleSide,
			}),
		}),
		[],
	);

	const camT = ramp(f, 0, 210, ease.inOutSine);
	const camAngle = mix(-0.10, 0.06, camT);
	const camDist = mix(14.2, 13.0, camT);

	return (
		<AbsoluteFill style={{backgroundColor: `rgba(5,5,5,${bg})`}}>
			<ThreeCanvas
				width={1080}
				height={1920}
				shadows
				gl={{antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true}}
				style={{position: 'absolute', inset: 0}}
			>
				<CameraRig
					position={[Math.sin(camAngle) * camDist, mix(0.3, -0.2, camT), Math.cos(camAngle) * camDist]}
					target={[0, mix(0.15, -0.1, camT), -0.6]}
					fov={30}
				/>
				<Exposure value={1.55} />
				<StudioEnv
					intensity={1.0 * light}
					panels={[
						{position: [-6, 8, 6], size: [8, 4], intensity: 2.2},
						{position: [8, 2, -4], size: [2, 10], intensity: 1.6},
						{position: [-9, -1, 2], size: [1.5, 9], intensity: 0.9},
					]}
				/>
				<directionalLight
					position={[-4, 7, 6]}
					intensity={3.6 * light}
					castShadow
					shadow-mapSize-width={2048}
					shadow-mapSize-height={2048}
					shadow-bias={-0.0004}
					shadow-normalBias={0.03}
					shadow-camera-left={-6}
					shadow-camera-right={6}
					shadow-camera-top={6}
					shadow-camera-bottom={-6}
					shadow-camera-near={1}
					shadow-camera-far={30}
				/>
				<directionalLight position={[6, 2, -6]} intensity={4.5 * light} />
				<Silk t={t} motion={cloth} castShadow receiveShadow>
					<primitive object={mats.face} attach="material" />
				</Silk>
				<Silk t={t} motion={cloth} receiveShadow>
					<primitive object={mats.back} attach="material" />
				</Silk>
				<Silk t={t} motion={band} segV={10} castShadow receiveShadow>
					<primitive object={mats.green} attach="material" />
				</Silk>
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={26} outAt={142} bottom={1660} />
		</AbsoluteFill>
	);
};
