import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {KineticText} from '../components/KineticText';
import {Silk, type SilkMotion} from '../three/Silk';
import {CameraRig, Exposure, StudioEnv} from '../three/StudioEnv';
import {GlowLine} from '../three/Glow';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

const PI = Math.PI;
// World y that projects to screen y = 1440 (the floor line of scene 08) for a
// camera at z = 12, fov 30, looking at the origin.
export const S07_LINE_Y = -((1440 - 960) / 960) * 12 * Math.tan((15 * PI) / 180);

// Green satin travelling through a dark space. At the end the cloth
// straightens, turns edge-on and thins into a horizontal line of light.
const makeRibbon = (k: number): SilkMotion => {
	const flat = (a: number, b: number) => a + (b - a) * k;
	return {
		path: (s, t) => [
			flat(s * 9.0 + 0.45 * Math.sin(1.6 * PI * s + 0.5 * t) + (t - 2.6) * 0.9, s * 12),
			flat(0.8 * Math.sin(1.25 * PI * s + 0.45 * t + 0.4) + 0.25 * Math.sin(3.1 * PI * s - 0.6 * t) - 0.55 - 0.9 * s, S07_LINE_Y),
			flat(1.1 * Math.sin(1.7 * PI * s - 0.4 * t + 1.0) - 0.4, 0),
		],
		twist: (s, t) => flat(0.6 + 1.5 * Math.sin(1.5 * PI * s - 0.55 * t + 0.9) + 0.5 * Math.sin(3.6 * PI * s + 0.3 * t), PI / 2),
		width: (s) => flat(1.15 * (1 - 0.2 * Math.cos(2 * PI * s)), 0.05),
		cup: (s, t) => (1 - k) * (0.7 * Math.sin(2.2 * PI * s - 0.5 * t) + 0.3 * Math.sin(6.4 * PI * s + 0.4 * t + 0.7)),
		flutter: {amp: 0.08 * (1 - k), freq: 4.0, speed: 0.35, seed: 2.2},
	};
};

export const S07Processo: React.FC<SceneProps> = ({f}) => {
	const m = meta('S07');
	const t = 2.6 + f / 60;
	const k = ramp(f, 132, 176, ease.inOut);
	const ribbon = makeRibbon(k);
	const fadeIn = ramp(f, -18, 4, ease.inOutSine);
	const lineGlow = ramp(f, 150, 176, ease.inOutSine);

	const mat = useMemo(
		() =>
			new THREE.MeshPhysicalMaterial({
				color: '#03401a',
				roughness: 0.28,
				sheen: 1.0,
				sheenColor: new THREE.Color('#38e868'),
				sheenRoughness: 0.28,
				specularIntensity: 1.0,
				emissive: new THREE.Color(COLORS.green),
				emissiveIntensity: 0.04,
				side: THREE.DoubleSide,
			}),
		[],
	);
	mat.emissiveIntensity = 0.04 + 1.6 * lineGlow;

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: fadeIn}}>
			<ThreeCanvas width={1080} height={1920} shadows gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={[COLORS.black]} />
				<CameraRig position={[mix(-0.25, 0.25, ramp(f, -18, 188)), 0, 12]} target={[0, 0, 0]} fov={30} />
				<Exposure value={1.35} />
				<StudioEnv
					intensity={0.9}
					panels={[
						{position: [-5, 8, 7], size: [8, 4], intensity: 2.0},
						{position: [9, 0, -3], size: [2, 10], intensity: 1.4},
					]}
				/>
				<directionalLight
					position={[-3, 7, 7]}
					intensity={3.4}
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
				<directionalLight position={[5, -1, -6]} intensity={4.0} />
				<Silk t={t} motion={ribbon} castShadow receiveShadow>
					<primitive object={mat} attach="material" />
				</Silk>
				{lineGlow > 0.001 ? (
					<GlowLine from={[-7, S07_LINE_Y, 0.05]} to={[7, S07_LINE_Y, 0.05]} width={0.5} core={0.012} color={COLORS.green} intensity={1.1 * lineGlow} fadeEnds={0.05} />
				) : null}
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={28} outAt={128} top={250} />
		</AbsoluteFill>
	);
};
