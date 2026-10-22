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

// Green cloth sweeps in over scene 13 and fills the frame; its motion then
// decelerates to a stop while the light turns hard and the satin cools to
// porcelain: the cloth becomes a still sculpture with green edges.
const folds = (i: number, enter: number): SilkMotion => ({
	path: (s, t) => [
		s * 7.5 + 0.5 * Math.sin(1.4 * PI * s + 0.4 * t + i) + (1 - enter) * (9 + i * 2),
		0.9 * Math.sin(1.1 * PI * s + 0.35 * t + i * 1.7) - 0.35 * s * (i - 1) + (i - 1) * 1.15 + (1 - enter) * 2,
		0.8 * Math.sin(1.9 * PI * s - 0.3 * t + i * 2.3) - i * 0.6,
	],
	twist: (s, t) => 0.4 + i * 0.5 + 0.9 * Math.sin(1.3 * PI * s - 0.5 * t + i * 0.9) + 0.18 * Math.sin(2.9 * PI * s + 0.3 * t),
	width: (s) => (2.2 - i * 0.3) * (1 - 0.18 * Math.cos(2 * PI * s)),
	cup: (s, t) => 0.5 * Math.sin(2.0 * PI * s - 0.45 * t + i) + 0.05 * Math.sin(5.2 * PI * s + 0.4 * t + i * 1.3),
	flutter: {amp: 0.015, freq: 2.6, speed: 0.3, seed: 3 + i},
});

export const S14Resultados: React.FC<SceneProps> = ({f}) => {
	const m = meta('S14');
	// Time slows to a stop: integral of a speed falling linearly from 1 to 0
	// between frames 60 and 150.
	const x = Math.min(Math.max(f - 60, 0), 90);
	const tEff = 3.0 + (Math.min(Math.max(f, -28), 60) + 28) / 60 + (x - (x * x) / 180) / 60;
	const enter = ramp(f, -28, 16, ease.outCubic);
	const sculpt = ramp(f, 70, 150, ease.inOut);
	const bg = ramp(f, -6, 20, ease.inOutSine);

	const mats = useMemo(
		() =>
			[0, 1, 2].map(
				() =>
					new THREE.MeshPhysicalMaterial({
						color: '#04501c',
						roughness: 0.3,
						sheen: 1.0,
						sheenColor: new THREE.Color('#42f070'),
						sheenRoughness: 0.3,
						side: THREE.DoubleSide,
					}),
			),
		[],
	);
	const green = new THREE.Color('#04501c');
	const porcelain = new THREE.Color('#c9c9c9');
	mats.forEach((mat, i) => {
		mat.color.copy(green).lerp(i === 1 ? new THREE.Color('#02240d') : porcelain, sculpt);
		mat.roughness = mix(0.3, i === 1 ? 0.3 : 0.55, sculpt);
		mat.sheen = mix(1.0, i === 1 ? 1.0 : 0.15, sculpt);
		mat.sheenColor.set('#42f070').lerp(new THREE.Color('#ffffff'), sculpt * (i === 1 ? 0 : 1));
	});

	const orbit = ramp(f, -28, 190, ease.inOutSine);
	return (
		<AbsoluteFill style={{backgroundColor: `rgba(5,5,5,${bg})`}}>
			<ThreeCanvas width={1080} height={1920} shadows gl={{antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<CameraRig position={[Math.sin(mix(-0.2, 0.32, orbit)) * 13, mix(0.4, 1.4, orbit), Math.cos(mix(-0.2, 0.32, orbit)) * 13]} target={[0, 0.2, -0.6]} fov={30} />
				<Exposure value={mix(1.4, 1.1, sculpt)} />
				<StudioEnv
					intensity={mix(0.9, 0.5, sculpt)}
					panels={[
						{position: [-5, 8, 7], size: [8, 4], intensity: 2.0},
						{position: [9, 0, -3], size: [2, 10], intensity: 1.6},
					]}
				/>
				<directionalLight
					position={[mix(-3, -7, sculpt), mix(7, 4, sculpt), 6]}
					intensity={mix(3.0, 4.2, sculpt)}
					castShadow
					shadow-mapSize-width={2048}
					shadow-mapSize-height={2048}
					shadow-bias={-0.0004}
					shadow-normalBias={0.03}
					shadow-camera-left={-7}
					shadow-camera-right={7}
					shadow-camera-top={7}
					shadow-camera-bottom={-7}
				/>
				<directionalLight position={[6, 1, -6]} intensity={mix(3.5, 5.0, sculpt)} color={new THREE.Color('#ffffff').lerp(new THREE.Color(COLORS.green), sculpt)} />
				{[0, 1, 2].map((i) => (
					<Silk key={i} t={tEff + i * 0.7} motion={folds(i, enter)} castShadow receiveShadow segU={380} segV={48}>
						<primitive object={mats[i]} attach="material" />
					</Silk>
				))}
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={30} outAt={138} top={250} />
		</AbsoluteFill>
	);
};
