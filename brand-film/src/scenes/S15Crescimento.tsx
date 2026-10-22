import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';
import {RectAreaLightUniformsLib} from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {KineticText} from '../components/KineticText';
import {CameraRig, Exposure, StudioEnv} from '../three/StudioEnv';
import {GlowLine} from '../three/Glow';
import {ReflectiveFloor} from '../three/ReflectiveFloor';
import {ease, mix, ramp} from '../lib/ease';
import {meta} from '../timeline';
import {COLORS} from '../theme';
import type {SceneProps} from './types';

RectAreaLightUniformsLib.init();

// Monoliths of increasing height rise out of a black floor, staggered in
// depth (a skyline, not a chart). Green light climbs the tallest one while the
// camera cranes up.
const PILLARS = [
	// One monolith per eighth note.
	{x: -2.9, z: 0.5, w: 1.0, d: 1.0, h: 1.4, yaw: 0.3, at: 0},
	{x: -1.4, z: -1.6, w: 1.2, d: 1.2, h: 2.7, yaw: 0.3, at: 22.5},
	{x: 0.2, z: -3.8, w: 1.35, d: 1.35, h: 4.4, yaw: 0.3, at: 45},
	{x: 1.9, z: -6.2, w: 1.5, d: 1.5, h: 6.6, yaw: 0.3, at: 67.5},
	{x: 3.7, z: -9.0, w: 1.8, d: 1.8, h: 10.0, yaw: 0.3, at: 90},
];

export const S15Crescimento: React.FC<SceneProps> = ({f}) => {
	const m = meta('S15');
	const mats = useMemo(() => {
		return {
			stone: new THREE.MeshStandardMaterial({color: '#363636', roughness: 0.82}),
			line: new THREE.MeshBasicMaterial({color: COLORS.green, toneMapped: false}),
		};
	}, []);
	const crane = ramp(f, -10, 182, ease.camera);
	const camPos: [number, number, number] = [mix(-4.6, -3.8, crane), mix(0.6, 4.2, crane), mix(9.5, 11.0, crane)];
	const target: [number, number, number] = [mix(0.4, 1.4, crane), mix(1.8, 5.6, crane), -5];
	const tall = PILLARS[PILLARS.length - 1];
	const tallRise = ramp(f, tall.at, tall.at + 50, ease.outExpo);
	const climb = ramp(f, 118, 172, ease.inOut);
	// Leading corner of the tallest monolith (nearest the camera).
	const half = tall.w / 2;
	const cx = tall.x + (-half * Math.cos(tall.yaw) + half * Math.sin(tall.yaw));
	const cz = tall.z + (half * Math.sin(tall.yaw) + half * Math.cos(tall.yaw));
	const lineTop = tall.h * climb;

	return (
		<AbsoluteFill style={{backgroundColor: COLORS.black, opacity: ramp(f, -10, 0)}}>
			<ThreeCanvas width={1080} height={1920} gl={{antialias: true, preserveDrawingBuffer: true}} style={{position: 'absolute', inset: 0}}>
				<color attach="background" args={['#000000']} />
				<fog attach="fog" args={['#060606', 16, 46]} />
				<CameraRig position={camPos} target={target} fov={44} />
				<Exposure value={1.35} />
				<StudioEnv intensity={0.35} panels={[{position: [0, 10, 0], size: [10, 4], intensity: 1.4}]} />
				<ReflectiveFloor color="#070707" roughness={0.3} reflectivity={0.5} blur={0.011} distortion={0.35} />
				<rectAreaLight position={[-2, 14, 2]} rotation={[-Math.PI / 2.1, -0.3, 0]} width={10} height={4} intensity={1.6} />
				<rectAreaLight position={[4, 9, -20]} rotation={[0, Math.PI, 0]} width={18} height={6} intensity={0.55} />
				<directionalLight position={[-7, 8, 10]} intensity={1.9} />
				<directionalLight position={[8, 3, -4]} intensity={0.5} />
				{PILLARS.map((p, i) => {
					const k = ramp(f, p.at, p.at + 50, ease.outExpo);
					const h = Math.max(p.h * k, 0.001);
					return (
						<mesh key={i} position={[p.x, h / 2, p.z]} rotation={[0, p.yaw, 0]} material={mats.stone}>
							<boxGeometry args={[p.w, h, p.d]} />
						</mesh>
					);
				})}
				{climb > 0.001 && tallRise > 0.99 ? (
					<>
						<mesh position={[cx, lineTop / 2, cz]} material={mats.line}>
							<boxGeometry args={[0.035, lineTop, 0.035]} />
						</mesh>
						<rectAreaLight position={[cx, lineTop / 2, cz + 0.05]} rotation={[0, Math.PI, 0]} width={0.06} height={Math.max(lineTop, 0.01)} intensity={60} color={COLORS.green} />
						<GlowLine from={[cx, 0, cz + 0.02]} to={[cx, lineTop, cz + 0.02]} width={1.0} core={0.035} color={COLORS.green} intensity={0.95} fadeEnds={0.01} />
					</>
				) : null}
			</ThreeCanvas>
			<KineticText lines={m.lines} f={f} inAt={30} outAt={140} top={250} />
		</AbsoluteFill>
	);
};
